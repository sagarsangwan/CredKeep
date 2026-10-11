import uuid
from decimal import Decimal
from django.db import transaction, IntegrityError, models
from django.utils import timezone
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.models import Device
from ledger.models import (
    Borrower,
    LoanAccount,
    Kist,
    Transaction as LedgerTx,
    ScheduleModification,
    SyncLog,
    SyncOutbox,
)
from ledger.engine.schedule import generate_schedule
from ledger.engine import ledger_service


class SyncPushView(APIView):
    """
    Accepts an ordered batch of offline operations from a client device.
    Processes each operation idempotently, records mutations to SyncOutbox,
    and returns status per operation_id (ACCEPTED, REJECTED, NEEDS_REVIEW).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {"error": "User does not have an active tenant."},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"error": "Invalid request body format: expected JSON object."},
                status=status.HTTP_400_BAD_REQUEST
            )

        operations = data.get('operations')
        if operations is None or not isinstance(operations, list):
            return Response(
                {"error": "Missing or invalid 'operations' list."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resolve or create Device
        device = None
        device_id_raw = data.get('device_id')
        if device_id_raw:
            try:
                dev_uuid = uuid.UUID(str(device_id_raw))
                existing_device = Device.objects.filter(id=dev_uuid).first()
                if existing_device and existing_device.tenant_id != tenant.id:
                    return Response(
                        {"error": "Device ID is registered to another tenant."},
                        status=status.HTTP_409_CONFLICT
                    )
                device, _ = Device.objects.get_or_create(
                    id=dev_uuid,
                    tenant=tenant,
                    defaults={'last_sync': timezone.now()}
                )
            except (ValueError, TypeError):
                return Response(
                    {"error": "Invalid device_id format."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except IntegrityError:
                return Response(
                    {"error": "Device ID collision with another tenant."},
                    status=status.HTTP_409_CONFLICT
                )

        if not device:
            try:
                device = Device.objects.filter(tenant=tenant).first()
                if not device:
                    device = Device.objects.create(tenant=tenant, last_sync=timezone.now())
                else:
                    device.last_sync = timezone.now()
                    device.save(update_fields=['last_sync'])
            except Exception:
                device = Device.objects.filter(tenant=tenant).first()

        results = []

        for op in operations:
            if not isinstance(op, dict):
                results.append({
                    "operation_id": None,
                    "status": "REJECTED",
                    "error": "Operation item must be an object."
                })
                continue

            op_id_raw = op.get('operation_id')
            if not op_id_raw:
                results.append({
                    "operation_id": None,
                    "status": "REJECTED",
                    "error": "Missing operation_id."
                })
                continue

            try:
                operation_id = uuid.UUID(str(op_id_raw))
            except (ValueError, TypeError):
                results.append({
                    "operation_id": str(op_id_raw),
                    "status": "REJECTED",
                    "error": "Invalid UUID format for operation_id."
                })
                continue

            try:
                op_type = op.get('type') or op.get('operation_type')
                payload = op.get('payload', {})
                if not isinstance(payload, dict):
                    payload = {}

                # Idempotency check against SyncLog
                existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
                if existing_log:
                    has_conflict, conflict_reason = self._check_idempotency_conflict(
                        tenant, operation_id, op_type, op, payload, existing_log=existing_log
                    )
                    if has_conflict:
                        results.append({
                            "operation_id": str(operation_id),
                            "status": "REJECTED",
                            "error": conflict_reason or f"Idempotency conflict: operation_id {operation_id} was already processed with different attributes."
                        })
                        continue

                    res_item = {
                        "operation_id": str(operation_id),
                        "status": existing_log.status,
                    }
                    if existing_log.error_message:
                        res_item["error"] = existing_log.error_message
                    results.append(res_item)
                    continue

                with transaction.atomic():
                    res_status, err_msg = self._process_operation(
                        tenant=tenant,
                        device=device,
                        operation_id=operation_id,
                        op_type=op_type,
                        op=op,
                        payload=payload
                    )

                    if res_status == 'REJECTED':
                        raise ValidationError(err_msg or 'Operation rejected.')

                    try:
                        SyncLog.objects.create(
                            tenant=tenant,
                            device=device,
                            operation_id=operation_id,
                            operation_type=op_type or '',
                            request_payload=payload if isinstance(payload, dict) else {},
                            status=res_status,
                            error_message=err_msg or ''
                        )
                    except IntegrityError:
                        existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
                        existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
                        if existing_log or existing_tx:
                            has_conflict, conflict_reason = self._check_idempotency_conflict(
                                tenant, operation_id, op_type, op, payload, existing_log=existing_log, existing_tx=existing_tx
                            )
                            if has_conflict:
                                res_status = 'REJECTED'
                                err_msg = conflict_reason
                            elif existing_log:
                                res_status = existing_log.status
                                err_msg = existing_log.error_message

                    res_item = {
                        "operation_id": str(operation_id),
                        "status": res_status,
                    }
                    if err_msg:
                        res_item["error"] = err_msg
                    results.append(res_item)

            except (ValidationError, ValueError, TypeError, AttributeError) as e:
                err_text = str(e)
                if "idempotency conflict" in err_text.lower():
                    results.append({
                        "operation_id": str(operation_id),
                        "status": "REJECTED",
                        "error": err_text
                    })
                    continue

                existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
                existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
                if existing_log or existing_tx:
                    has_conflict, conflict_reason = self._check_idempotency_conflict(
                        tenant, operation_id, op_type, op, payload, existing_log=existing_log, existing_tx=existing_tx
                    )
                    if has_conflict:
                        results.append({
                            "operation_id": str(operation_id),
                            "status": "REJECTED",
                            "error": conflict_reason or err_text
                        })
                    elif existing_log:
                        results.append({
                            "operation_id": str(operation_id),
                            "status": existing_log.status,
                            "error": existing_log.error_message or None
                        })
                    else:
                        results.append({
                            "operation_id": str(operation_id),
                            "status": "REJECTED",
                            "error": err_text
                        })
                else:
                    try:
                        SyncLog.objects.create(
                            tenant=tenant,
                            device=device,
                            operation_id=operation_id,
                            operation_type=op_type or '',
                            request_payload=payload if isinstance(payload, dict) else {},
                            status='REJECTED',
                            error_message=err_text
                        )
                    except IntegrityError:
                        pass
                    results.append({
                        "operation_id": str(operation_id),
                        "status": "REJECTED",
                        "error": err_text
                    })

            except Exception as e:
                # Transient infrastructure / database failure: do NOT poison with permanent REJECTED SyncLog
                err_text = str(e)
                if "idempotency conflict" in err_text.lower():
                    results.append({
                        "operation_id": str(operation_id),
                        "status": "REJECTED",
                        "error": err_text
                    })
                    continue

                existing_log = None
                existing_tx = None
                try:
                    existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
                    existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
                except Exception:
                    pass
                if existing_log or existing_tx:
                    has_conflict, conflict_reason = self._check_idempotency_conflict(
                        tenant, operation_id, op_type, op, payload, existing_log=existing_log, existing_tx=existing_tx
                    )
                    if has_conflict:
                        results.append({
                            "operation_id": str(operation_id),
                            "status": "REJECTED",
                            "error": conflict_reason or err_text
                        })
                    elif existing_log:
                        results.append({
                            "operation_id": str(operation_id),
                            "status": existing_log.status,
                            "error": existing_log.error_message or None
                        })
                    else:
                        results.append({
                            "operation_id": str(operation_id),
                            "status": "FAILED",
                            "error": err_text
                        })
                else:
                    results.append({
                        "operation_id": str(operation_id),
                        "status": "FAILED",
                        "error": err_text
                    })

        return Response({"results": results}, status=status.HTTP_200_OK)

    def _check_idempotency_conflict(self, tenant, operation_id, op_type, op, payload, existing_log=None, existing_tx=None):
        """
        Validates an incoming operation against existing_log, existing_tx, or existing_mod.
        Returns (has_conflict: bool, conflict_reason: str or None).
        """
        if existing_log and existing_log.operation_type and op_type and existing_log.operation_type != op_type:
            return True, f"Idempotency conflict: operation_id {operation_id} was already processed with operation_type '{existing_log.operation_type}', cannot replay as '{op_type}'."

        if existing_tx is None:
            existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()

        if op_type == 'record_collection':
            if not existing_tx:
                if existing_log and existing_log.status == 'ACCEPTED':
                    return True, f"Idempotency conflict: operation_id {operation_id} was already processed without creating a collection transaction."
            elif existing_tx.transaction_type != 'COLLECTION':
                return True, f"Idempotency conflict: operation_id {operation_id} was already processed as a {existing_tx.transaction_type} transaction, cannot replay as record_collection."
        elif op_type == 'waive_penalty':
            if not existing_tx:
                if existing_log and existing_log.status == 'ACCEPTED':
                    return True, f"Idempotency conflict: operation_id {operation_id} was already processed without creating a penalty waiver transaction."
            elif existing_tx.transaction_type != 'REVERSAL':
                return True, f"Idempotency conflict: operation_id {operation_id} was already processed as a {existing_tx.transaction_type} transaction, cannot replay as waive_penalty."
        elif existing_tx and op_type in ('create_borrower', 'create_loan', 'postpone_due_date'):
            return True, f"Idempotency conflict: operation_id {operation_id} was already processed as a transaction, cannot replay as '{op_type}'."

        # Transaction attribute verification
        if existing_tx:
            req_loan_id = str(payload.get('loan_id') or op.get('loan_id') or '')
            raw_req_amount = payload.get('amount_paise') if 'amount_paise' in payload else op.get('amount_paise')
            req_date = str(payload.get('effective_date') or op.get('timestamp') or '')
            if 'T' in req_date:
                req_date = req_date.split('T')[0]

            if req_loan_id and req_loan_id != str(existing_tx.loan.id):
                return True, f"Idempotency conflict: loan_id {req_loan_id} does not match existing transaction loan_id {existing_tx.loan.id}."

            orig_req_date = None
            if existing_log and existing_log.request_payload and isinstance(existing_log.request_payload, dict):
                orig_req_date = str(existing_log.request_payload.get('effective_date') or existing_log.request_payload.get('timestamp') or '')
                if 'T' in orig_req_date:
                    orig_req_date = orig_req_date.split('T')[0]

            if orig_req_date:
                if req_date != orig_req_date:
                    return True, f"Idempotency conflict: effective_date {req_date} does not match original requested date {orig_req_date}."
            elif req_date and req_date != str(existing_tx.effective_date):
                if not (existing_tx.transaction_type == 'REVERSAL' and req_date > str(existing_tx.effective_date)):
                    return True, f"Idempotency conflict: effective_date {req_date} does not match existing transaction date {existing_tx.effective_date}."

            if existing_tx.transaction_type == 'COLLECTION':
                raw_method = payload.get('payment_method') or op.get('payment_method')
                if raw_method is not None and not isinstance(raw_method, str):
                    return True, "Idempotency conflict: payment_method must be a string."
                else:
                    req_method = (raw_method or 'CASH').upper()
                    req_is_cash = payload.get('is_cash', req_method == 'CASH')
                    if not isinstance(req_is_cash, bool):
                        req_is_cash = req_method == 'CASH'
                    if req_method != existing_tx.payment_method or bool(req_is_cash) != bool(existing_tx.is_cash):
                        return True, "Idempotency conflict: payment method or cash classification changed."

                if raw_req_amount is not None:
                    if isinstance(raw_req_amount, bool) or not isinstance(raw_req_amount, int):
                        return True, "Idempotency conflict: amount_paise must be an integer."
                    elif raw_req_amount != existing_tx.amount_paise:
                        return True, f"Idempotency conflict: amount {raw_req_amount} does not match existing transaction amount {existing_tx.amount_paise}."

            elif existing_tx.transaction_type == 'REVERSAL':
                orig_req_amount = None
                if existing_log and existing_log.request_payload and isinstance(existing_log.request_payload, dict):
                    orig_req_amount = existing_log.request_payload.get('amount_paise')
                if orig_req_amount is None:
                    outbox_rec = SyncOutbox.objects.filter(tenant=tenant, record_id=existing_tx.id).first()
                    if outbox_rec and isinstance(outbox_rec.payload, dict) and 'requested_amount_paise' in outbox_rec.payload:
                        orig_req_amount = outbox_rec.payload.get('requested_amount_paise')
                    else:
                        orig_req_amount = existing_tx.forgiven_penalty_paise

                if raw_req_amount is not None:
                    if isinstance(raw_req_amount, bool) or not isinstance(raw_req_amount, int):
                        return True, "Idempotency conflict: amount_paise must be an integer."
                    elif raw_req_amount != orig_req_amount:
                        return True, f"Idempotency conflict: original requested waiver was {orig_req_amount} paise, retry requested {raw_req_amount} paise."

        # Non-transaction payload verification against persisted request_payload
        orig_p = None
        if existing_log and existing_log.request_payload and isinstance(existing_log.request_payload, dict):
            orig_p = existing_log.request_payload
            if op_type == 'create_borrower':
                if payload.get('phone') and str(payload.get('phone')) != str(orig_p.get('phone')):
                    return True, "Idempotency conflict: borrower phone changed."
                if payload.get('name') and str(payload.get('name')) != str(orig_p.get('name')):
                    return True, "Idempotency conflict: borrower name changed."
            elif op_type == 'create_loan':
                if payload.get('borrower_id') and str(payload.get('borrower_id')) != str(orig_p.get('borrower_id')):
                    return True, "Idempotency conflict: loan borrower_id changed."
                if payload.get('principal_paise') and payload.get('principal_paise') != orig_p.get('principal_paise'):
                    return True, "Idempotency conflict: loan principal changed."
                if payload.get('status') and orig_p.get('status') and payload.get('status') != orig_p.get('status'):
                    return True, "Idempotency conflict: loan status changed."
            elif op_type in ('modify_schedule', 'postpone_due_date'):
                req_loan = str(payload.get('loan_id') or op.get('loan_id') or '')
                if req_loan and orig_p.get('loan_id') and req_loan != str(orig_p.get('loan_id')):
                    return True, "Idempotency conflict: modify_schedule loan_id changed."
                if payload.get('kist_id') and orig_p.get('kist_id') and str(payload.get('kist_id')) != str(orig_p.get('kist_id')):
                    return True, "Idempotency conflict: modify_schedule kist_id changed."
                if payload.get('installment_number') is not None and orig_p.get('installment_number') is not None and str(payload.get('installment_number')) != str(orig_p.get('installment_number')):
                    return True, "Idempotency conflict: modify_schedule installment_number changed."
                if payload.get('revised_effective_due_date') and orig_p.get('revised_effective_due_date') and str(payload.get('revised_effective_due_date')) != str(orig_p.get('revised_effective_due_date')):
                    return True, "Idempotency conflict: modify_schedule revised_effective_due_date changed."
                if payload.get('accrued_penalty_action', 'NONE') != orig_p.get('accrued_penalty_action', 'NONE'):
                    return True, "Idempotency conflict: modify_schedule accrued_penalty_action changed."
                if payload.get('waived_penalty_paise', 0) != orig_p.get('waived_penalty_paise', 0):
                    return True, "Idempotency conflict: modify_schedule waived_penalty_paise changed."
            elif op_type == 'record_collection':
                req_loan = str(payload.get('loan_id') or op.get('loan_id') or '')
                if req_loan and orig_p.get('loan_id') and req_loan != str(orig_p.get('loan_id')):
                    return True, "Idempotency conflict: collection loan_id changed."
                req_amt = payload.get('amount_paise') if 'amount_paise' in payload else op.get('amount_paise')
                if req_amt is not None and orig_p.get('amount_paise') is not None and req_amt != orig_p.get('amount_paise'):
                    return True, f"Idempotency conflict: collection amount_paise changed from {orig_p.get('amount_paise')} to {req_amt}."

        if op_type in ('modify_schedule', 'postpone_due_date'):
            existing_mod = ScheduleModification.objects.filter(tenant=tenant, operation_id=operation_id).first()
            if existing_mod:
                req_loan = str(payload.get('loan_id') or op.get('loan_id') or '')
                if req_loan and req_loan != str(existing_mod.loan.id):
                    return True, "Idempotency conflict: modify_schedule loan_id changed."
                if payload.get('revised_effective_due_date') and str(payload.get('revised_effective_due_date')) != str(existing_mod.revised_effective_due_date):
                    return True, "Idempotency conflict: modify_schedule revised_effective_due_date changed."
                if payload.get('kist_id') and str(payload.get('kist_id')) != str(existing_mod.kist.id):
                    return True, "Idempotency conflict: modify_schedule kist_id changed."
                if payload.get('installment_number') is not None and int(payload.get('installment_number')) != existing_mod.kist.installment_number:
                    return True, "Idempotency conflict: modify_schedule installment_number changed."
                if not orig_p:
                    if payload.get('accrued_penalty_action') and payload.get('accrued_penalty_action') != existing_mod.accrued_penalty_action:
                        return True, "Idempotency conflict: modify_schedule accrued_penalty_action changed."
                    if existing_mod.accrued_penalty_action != 'WAIVE' and payload.get('waived_penalty_paise') is not None and payload.get('waived_penalty_paise') != existing_mod.waived_penalty_paise:
                        return True, "Idempotency conflict: modify_schedule waived_penalty_paise changed."

        return False, None

    def _process_operation(self, tenant, device, operation_id, op_type, op, payload):
        """
        Processes an individual operation within an atomic transaction.
        Returns (status_string, error_message_or_None).
        """
        if op_type == 'create_borrower':
            name = payload.get('name', '').strip()
            phone = payload.get('phone', '').strip()
            if not name or not phone:
                return 'REJECTED', 'Borrower name and phone are required.'

            borrower_id_raw = payload.get('id')
            if borrower_id_raw:
                try:
                    borrower_id = uuid.UUID(str(borrower_id_raw))
                except ValueError:
                    return 'REJECTED', f'Invalid borrower id UUID format: {borrower_id_raw}'
            else:
                borrower_id = uuid.uuid4()

            borrower, created = Borrower.objects.get_or_create(
                tenant=tenant,
                phone=phone,
                defaults={'id': borrower_id, 'name': name}
            )
            if not created:
                borrower.name = name
                borrower.save(update_fields=['name'])

            SyncOutbox.objects.create(
                tenant=tenant,
                record_type='BORROWER',
                record_id=borrower.id,
                operation_type='INSERT' if created else 'UPDATE',
                payload={
                    'id': str(borrower.id),
                    'name': borrower.name,
                    'phone': borrower.phone
                }
            )
            return 'ACCEPTED', None

        elif op_type == 'create_loan':
            borrower_id_raw = payload.get('borrower_id')
            if not borrower_id_raw:
                return 'REJECTED', 'Missing borrower_id.'

            try:
                borrower = Borrower.objects.get(tenant=tenant, id=uuid.UUID(str(borrower_id_raw)))
            except (Borrower.DoesNotExist, ValueError):
                return 'REJECTED', f'Borrower {borrower_id_raw} not found for this tenant.'

            loan_id_raw = payload.get('id')
            if loan_id_raw:
                try:
                    loan_id = uuid.UUID(str(loan_id_raw))
                except ValueError:
                    return 'REJECTED', f'Invalid loan id UUID format: {loan_id_raw}'
            else:
                loan_id = uuid.uuid4()

            raw_principal = payload.get('principal_paise')
            if raw_principal is None or isinstance(raw_principal, bool) or not isinstance(raw_principal, int) or raw_principal <= 0:
                return 'REJECTED', 'principal_paise must be an exact positive integer in paise.'
            principal_paise = raw_principal

            try:
                markup_factor = Decimal(str(payload.get('markup_factor', '0')))
                if markup_factor.is_nan() or markup_factor.is_infinite() or markup_factor < 0:
                    return 'REJECTED', 'markup_factor must be a finite non-negative number.'
                if markup_factor.as_tuple().exponent < -4:
                    return 'REJECTED', 'markup_factor cannot exceed 4 decimal places.'
                markup_factor = markup_factor.quantize(Decimal('0.0001'))
            except Exception:
                return 'REJECTED', 'Invalid markup_factor.'

            raw_term = payload.get('term_months')
            if raw_term is None or isinstance(raw_term, bool) or not isinstance(raw_term, int) or raw_term <= 0:
                return 'REJECTED', 'term_months must be an exact positive integer.'
            term_months = raw_term

            start_date = str(payload.get('start_date', ''))
            if not start_date:
                return 'REJECTED', 'Missing start_date.'

            raw_due_day = payload.get('due_day', 1)
            if raw_due_day is None or isinstance(raw_due_day, bool) or not isinstance(raw_due_day, int) or raw_due_day < 1 or raw_due_day > 31:
                return 'REJECTED', 'due_day must be an integer between 1 and 31.'
            due_day = raw_due_day

            product_type = payload.get('product_type', 'instalment')
            if product_type not in ('instalment', 'bullet'):
                return 'REJECTED', f"Unsupported product_type '{product_type}'. Must be 'instalment' or 'bullet'."

            raw_status = payload.get('status', 'ACTIVE')
            if raw_status == 'SETTLED':
                return 'REJECTED', "Cannot create loan with terminal status 'SETTLED'. Newly created loans must start with active schedules to reconstruct repayment accounting."
            status = 'WRITTEN_OFF' if raw_status == 'WRITTEN_OFF' else 'ACTIVE'

            loan = LoanAccount.objects.create(
                id=loan_id,
                tenant=tenant,
                borrower=borrower,
                principal_paise=principal_paise,
                markup_factor=markup_factor,
                term_months=term_months,
                start_date=start_date,
                due_day=due_day,
                product_type=product_type,
                status=status
            )

            # Emit LOAN outbox record FIRST so replica devices process parent loan before child kists
            SyncOutbox.objects.create(
                tenant=tenant,
                record_type='LOAN',
                record_id=loan.id,
                operation_type='INSERT',
                payload={
                    'id': str(loan.id),
                    'borrower_id': str(loan.borrower_id),
                    'principal_paise': loan.principal_paise,
                    'markup_factor': str(loan.markup_factor),
                    'term_months': loan.term_months,
                    'start_date': str(loan.start_date),
                    'due_day': loan.due_day,
                    'product_type': loan.product_type,
                    'status': loan.status
                }
            )

            # Generate initial kist schedule
            schedule_items = generate_schedule(
                principal_paise=principal_paise,
                markup_factor=markup_factor,
                term_months=term_months,
                start_date_str=start_date,
                due_day=due_day,
                product_type=product_type
            )

            for item in schedule_items:
                kist = Kist.objects.create(
                    tenant=tenant,
                    loan=loan,
                    installment_number=item.kist_number,
                    original_due_date=item.due_date,
                    effective_due_date=item.due_date,
                    principal_component_paise=item.principal_due,
                    markup_component_paise=item.markup_due,
                    total_due_paise=item.amount_due,
                    status='PENDING'
                )
                SyncOutbox.objects.create(
                    tenant=tenant,
                    record_type='KIST',
                    record_id=kist.id,
                    operation_type='INSERT',
                    payload={
                        'id': str(kist.id),
                        'loan_id': str(loan.id),
                        'installment_number': kist.installment_number,
                        'original_due_date': str(kist.original_due_date),
                        'effective_due_date': str(kist.effective_due_date),
                        'principal_component_paise': kist.principal_component_paise,
                        'markup_component_paise': kist.markup_component_paise,
                        'total_due_paise': kist.total_due_paise,
                        'status': kist.status
                    }
                )
            return 'ACCEPTED', None

        elif op_type == 'record_collection':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.select_for_update().get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            raw_amount = payload.get('amount_paise')
            if raw_amount is None or isinstance(raw_amount, bool) or not isinstance(raw_amount, int):
                return 'REJECTED', 'Payment amount_paise must be an exact positive integer in paise.'
            if raw_amount <= 0:
                return 'REJECTED', 'Payment amount must be greater than zero.'
            amount_paise = raw_amount

            effective_date = (
                payload.get('effective_date') or
                op.get('timestamp') or
                str(timezone.now().date())
            )
            if isinstance(effective_date, str) and 'T' in effective_date:
                effective_date = effective_date.split('T')[0]

            raw_method = payload.get('payment_method')
            if raw_method is not None and not isinstance(raw_method, str):
                return 'REJECTED', f'payment_method must be a string: {raw_method}'
            payment_method = (raw_method or 'CASH').upper()
            allowed_methods = {choice[0] for choice in LedgerTx.PAYMENT_METHODS}
            if payment_method not in allowed_methods:
                return 'REJECTED', f"Unsupported payment_method: '{payment_method}'"
            is_cash = payload.get('is_cash', payment_method == 'CASH')
            if not isinstance(is_cash, bool):
                is_cash = payment_method == 'CASH'

            # Failure Matrix invariant: Money received on settled loan is recorded, marked as surplus, and loan remains settled.
            if loan.status in ('SETTLED', 'WRITTEN_OFF'):
                existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
                if existing_tx:
                    if (
                        str(existing_tx.loan.id) != str(loan.id) or
                        existing_tx.amount_paise != amount_paise or
                        str(existing_tx.effective_date) != str(effective_date) or
                        existing_tx.transaction_type != 'COLLECTION' or
                        existing_tx.payment_method != payment_method or
                        bool(existing_tx.is_cash) != bool(is_cash)
                    ):
                        return 'REJECTED', f"Idempotency conflict: operation_id {operation_id} already exists with different payment attributes."
                    return 'ACCEPTED', None

                surplus_tx = LedgerTx.objects.create(
                    tenant=tenant,
                    operation_id=operation_id,
                    loan=loan,
                    transaction_type='COLLECTION',
                    is_cash=is_cash,
                    payment_method=payment_method,
                    amount_paise=amount_paise,
                    allocated_principal_paise=0,
                    allocated_markup_paise=0,
                    allocated_penalty_paise=0,
                    unallocated_surplus_paise=amount_paise,
                    effective_date=str(effective_date)
                )
                SyncOutbox.objects.create(
                    tenant=tenant,
                    record_type='TRANSACTION',
                    record_id=surplus_tx.id,
                    operation_type='INSERT',
                    payload={
                        'id': str(surplus_tx.id),
                        'operation_id': str(surplus_tx.operation_id),
                        'loan_id': str(loan.id),
                        'transaction_type': surplus_tx.transaction_type,
                        'is_cash': surplus_tx.is_cash,
                        'payment_method': surplus_tx.payment_method,
                        'amount_paise': surplus_tx.amount_paise,
                        'allocated_principal_paise': 0,
                        'allocated_markup_paise': 0,
                        'allocated_penalty_paise': 0,
                        'unallocated_surplus_paise': surplus_tx.unallocated_surplus_paise,
                        'forgiven_penalty_paise': 0,
                        'effective_date': str(surplus_tx.effective_date)
                    }
                )
                return 'ACCEPTED', None

            # Clock skew rule (docs/v2/10-sync-failure-matrix.md):
            # Authoritative server clock governs penalty assessments to prevent devices
            # from evading accrued late fees by backdating offline collection timestamps,
            # and bounds assessments so future timestamps cannot assess unearned late fees.
            server_date_str = str(timezone.now().date())
            assess_date_str = server_date_str
            ledger_service.assess_penalties(loan, assess_date_str)

            try:
                ledger_service.record_collection(
                    loan=loan,
                    payment_amount=amount_paise,
                    operation_id=operation_id,
                    effective_date_str=str(effective_date),
                    payment_method=payment_method,
                    is_cash=is_cash
                )
            except ValueError as val_err:
                return 'REJECTED', str(val_err)
            return 'ACCEPTED', None

        elif op_type == 'modify_schedule':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.select_for_update().get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            if loan.status in ('SETTLED', 'WRITTEN_OFF'):
                return 'NEEDS_REVIEW', f'Loan {loan.id} is already settled or written off.'

            kist = None
            if payload.get('kist_id'):
                try:
                    kist_uuid = uuid.UUID(str(payload['kist_id']))
                    kist = Kist.objects.filter(tenant=tenant, loan=loan, id=kist_uuid).first()
                except ValueError:
                    return 'REJECTED', f'Invalid kist_id UUID format: {payload["kist_id"]}'
            elif payload.get('installment_number'):
                try:
                    kist = Kist.objects.filter(tenant=tenant, loan=loan, installment_number=int(payload['installment_number'])).first()
                except (ValueError, TypeError):
                    return 'REJECTED', f'Invalid installment_number format: {payload.get("installment_number")}'

            if not kist:
                return 'REJECTED', 'Target installment (kist) not found for this loan.'

            revised_date = str(payload.get('revised_effective_due_date', ''))
            if not revised_date:
                return 'REJECTED', 'Missing revised_effective_due_date.'

            raw_waived_pen = payload.get('waived_penalty_paise', 0)
            if raw_waived_pen is not None and (isinstance(raw_waived_pen, bool) or not isinstance(raw_waived_pen, int) or raw_waived_pen < 0):
                return 'REJECTED', 'waived_penalty_paise must be an exact non-negative integer.'
            waived_pen = int(raw_waived_pen or 0)

            accrued_penalty_action = payload.get('accrued_penalty_action', 'NONE')
            if accrued_penalty_action not in ('NONE', 'WAIVE', 'CAP'):
                return 'REJECTED', f"Unsupported accrued_penalty_action '{accrued_penalty_action}'."

            # Unconditionally assess penalties through effective modification date before changing schedule due date.
            # Clock skew rule (docs/v2/10-sync-failure-matrix.md):
            # Authoritative server clock governs penalty assessments to prevent devices
            # from evading accrued late fees by backdating offline postponement timestamps.
            eff_today = payload.get('effective_date')
            if not eff_today and op.get('timestamp'):
                eff_today = str(op['timestamp'])
            if not eff_today:
                eff_today = str(timezone.now().date())
            eff_today = str(eff_today)
            if 'T' in eff_today:
                eff_today = eff_today.split('T')[0]
            server_date_str = str(timezone.now().date())
            assess_date_str = server_date_str
            ledger_service.assess_penalties(loan, assess_date_str)

            actual_waived = 0
            outstanding_pen = 0
            if accrued_penalty_action == 'WAIVE' or waived_pen > 0:

                total_assessed = (
                    LedgerTx.objects
                    .filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
                    .aggregate(total=models.Sum('amount_paise'))['total'] or 0
                )
                total_penalty_paid = (
                    LedgerTx.objects
                    .filter(loan=loan, transaction_type='COLLECTION')
                    .aggregate(total=models.Sum('allocated_penalty_paise'))['total'] or 0
                )
                total_penalty_waived = (
                    LedgerTx.objects
                    .filter(loan=loan, transaction_type='REVERSAL')
                    .aggregate(total=models.Sum('forgiven_penalty_paise'))['total'] or 0
                )
                outstanding_pen = max(0, total_assessed - total_penalty_paid - total_penalty_waived)

                if accrued_penalty_action == 'WAIVE' and waived_pen == 0:
                    actual_waived = outstanding_pen
                else:
                    actual_waived = min(waived_pen, outstanding_pen)

                if actual_waived > 0:
                    recon_op_id = uuid.uuid4()
                    tx = LedgerTx.objects.create(
                        tenant=tenant,
                        operation_id=recon_op_id,
                        loan=loan,
                        transaction_type='REVERSAL',
                        amount_paise=0,
                        forgiven_penalty_paise=actual_waived,
                        effective_date=eff_today
                    )
                    SyncOutbox.objects.create(
                        tenant=tenant,
                        record_type='TRANSACTION',
                        record_id=tx.id,
                        operation_type='INSERT',
                        payload={
                            'id': str(tx.id),
                            'operation_id': str(tx.operation_id),
                            'loan_id': str(loan.id),
                            'transaction_type': tx.transaction_type,
                            'forgiven_penalty_paise': tx.forgiven_penalty_paise,
                            'effective_date': str(tx.effective_date)
                        }
                    )

            ScheduleModification.objects.create(
                tenant=tenant,
                loan=loan,
                kist=kist,
                operation_id=operation_id,
                original_due_date=kist.original_due_date,
                prior_effective_due_date=kist.effective_due_date,
                revised_effective_due_date=revised_date,
                reason=payload.get('reason', ''),
                accrued_penalty_action=accrued_penalty_action,
                waived_penalty_paise=actual_waived
            )

            kist.effective_due_date = revised_date
            kist.save(update_fields=['effective_due_date'])

            SyncOutbox.objects.create(
                tenant=tenant,
                record_type='KIST',
                record_id=kist.id,
                operation_type='UPDATE',
                payload={
                    'id': str(kist.id),
                    'loan_id': str(loan.id),
                    'installment_number': kist.installment_number,
                    'effective_due_date': str(kist.effective_due_date)
                }
            )

            # Check if loan settles as a result of penalty waiver
            if actual_waived > 0:
                all_kists_paid = not loan.schedules.exclude(status='PAID').exists()
                past_p = (
                    LedgerTx.objects
                    .filter(loan=loan, transaction_type__in=('COLLECTION', 'REVERSAL'))
                    .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
                )
                remaining_pen = max(0, outstanding_pen - actual_waived)
                if all_kists_paid and remaining_pen <= 0 and past_p >= loan.principal_paise:
                    loan.status = 'SETTLED'
                    loan.save(update_fields=['status'])
                    SyncOutbox.objects.create(
                        tenant=tenant,
                        record_type='LOAN',
                        record_id=loan.id,
                        operation_type='UPDATE',
                        payload={
                            'id': str(loan.id),
                            'status': 'SETTLED'
                        }
                    )

            return 'ACCEPTED', None

        elif op_type == 'waive_penalty':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.select_for_update().get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            raw_waive = payload.get('amount_paise')
            if raw_waive is None or isinstance(raw_waive, bool) or not isinstance(raw_waive, int) or raw_waive <= 0:
                return 'REJECTED', 'Waiver amount must be an exact positive integer in paise.'
            waive_amount = raw_waive

            server_date_str = str(timezone.now().date())
            raw_eff = str(payload.get('effective_date') or server_date_str)
            if 'T' in raw_eff:
                raw_eff = raw_eff.split('T')[0]
            eff_date = min(raw_eff, server_date_str)

            # Assess penalties due up to eff_date first under the loan lock
            ledger_service.assess_penalties(loan, eff_date)

            total_assessed = (
                LedgerTx.objects
                .filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
                .aggregate(total=models.Sum('amount_paise'))['total'] or 0
            )
            total_penalty_paid = (
                LedgerTx.objects
                .filter(loan=loan, transaction_type='COLLECTION')
                .aggregate(total=models.Sum('allocated_penalty_paise'))['total'] or 0
            )
            total_penalty_waived = (
                LedgerTx.objects
                .filter(loan=loan, transaction_type='REVERSAL')
                .aggregate(total=models.Sum('forgiven_penalty_paise'))['total'] or 0
            )
            outstanding_pen = max(0, total_assessed - total_penalty_paid - total_penalty_waived)

            if outstanding_pen <= 0:
                return 'REJECTED', 'No outstanding penalty to waive.'

            actual_waived = min(waive_amount, outstanding_pen)

            tx = LedgerTx.objects.create(
                tenant=tenant,
                operation_id=operation_id,
                loan=loan,
                transaction_type='REVERSAL',
                amount_paise=0,
                forgiven_penalty_paise=actual_waived,
                effective_date=eff_date
            )

            SyncOutbox.objects.create(
                tenant=tenant,
                record_type='TRANSACTION',
                record_id=tx.id,
                operation_type='INSERT',
                payload={
                    'id': str(tx.id),
                    'operation_id': str(tx.operation_id),
                    'loan_id': str(loan.id),
                    'transaction_type': tx.transaction_type,
                    'forgiven_penalty_paise': tx.forgiven_penalty_paise,
                    'requested_amount_paise': waive_amount,
                    'effective_date': str(tx.effective_date)
                }
            )

            # Check if loan settles as a result of penalty waiver
            remaining_pen = outstanding_pen - actual_waived
            all_kists_paid = not loan.schedules.exclude(status='PAID').exists()
            past_p = (
                LedgerTx.objects
                .filter(loan=loan, transaction_type__in=('COLLECTION', 'REVERSAL'))
                .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
            )
            settled = False
            if all_kists_paid and remaining_pen <= 0 and past_p >= loan.principal_paise:
                loan.status = 'SETTLED'
                loan.save(update_fields=['status'])
                settled = True

            if settled:
                SyncOutbox.objects.create(
                    tenant=tenant,
                    record_type='LOAN',
                    record_id=loan.id,
                    operation_type='UPDATE',
                    payload={
                        'id': str(loan.id),
                        'status': 'SETTLED'
                    }
                )

            return 'ACCEPTED', None

        else:
            return 'REJECTED', f'Unknown operation type: {op_type}'


class SyncPullView(APIView):
    """
    Returns authoritative state changes for the tenant since the given cursor.
    Uses sequential pagination on SyncOutbox.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {"error": "User does not have an active tenant."},
                status=status.HTTP_403_FORBIDDEN
            )

        cursor_raw = request.query_params.get('cursor', '0')
        try:
            cursor = int(cursor_raw)
        except (ValueError, TypeError):
            cursor = 0

        limit_raw = request.query_params.get('limit', '100')
        try:
            limit = min(max(1, int(limit_raw)), 500)
        except (ValueError, TypeError):
            limit = 100

        records_qs = (
            SyncOutbox.objects
            .filter(tenant=tenant, sequence_number__gt=cursor)
            .order_by('sequence_number')[:limit + 1]
        )
        records = list(records_qs)

        has_more = len(records) > limit
        if has_more:
            records = records[:limit]

        next_cursor = records[-1].sequence_number if records else cursor

        changes = [
            {
                "id": str(r.id),
                "record_type": r.record_type,
                "record_id": str(r.record_id),
                "operation_type": r.operation_type,
                "payload": r.payload,
                "sequence_number": r.sequence_number,
                "created_at": r.created_at.isoformat()
            }
            for r in records
        ]

        return Response({
            "next_cursor": next_cursor,
            "has_more": has_more,
            "changes": changes
        }, status=status.HTTP_200_OK)


class PortfolioSummaryView(APIView):
    """
    Returns authoritative portfolio summary for the tenant:
    - active_loans_count
    - settled_loans_count
    - written_off_loans_count
    - total_loans_count
    - total_principal_paise
    - total_collections_paise
    - total_collections_count
    - total_waivers_paise
    - total_outstanding_balance_paise
    - loans: list of { id, status, principal_paise, outstanding_balance_paise }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {"error": "User does not have an active tenant."},
                status=status.HTTP_403_FORBIDDEN
            )

        loans = LoanAccount.objects.filter(tenant=tenant)
        active_loans_count = loans.filter(status='ACTIVE').count()
        settled_loans_count = loans.filter(status='SETTLED').count()
        written_off_loans_count = loans.filter(status='WRITTEN_OFF').count()
        total_loans_count = loans.count()
        total_principal_paise = loans.aggregate(total=models.Sum('principal_paise'))['total'] or 0

        collections = LedgerTx.objects.filter(tenant=tenant, transaction_type='COLLECTION')
        total_collections_paise = collections.aggregate(total=models.Sum('amount_paise'))['total'] or 0
        total_collections_count = collections.count()

        waivers = LedgerTx.objects.filter(tenant=tenant, transaction_type='REVERSAL')
        total_waivers_paise = waivers.aggregate(total=models.Sum('forgiven_penalty_paise'))['total'] or 0

        # Outstanding schedule balance on active loans
        active_kists = Kist.objects.filter(tenant=tenant, loan__status='ACTIVE')
        total_due = active_kists.aggregate(total=models.Sum('total_due_paise'))['total'] or 0
        total_p_paid = active_kists.aggregate(total=models.Sum('principal_paid_paise'))['total'] or 0
        total_m_paid = active_kists.aggregate(total=models.Sum('markup_paid_paise'))['total'] or 0
        outstanding_schedule_balance = max(0, total_due - (total_p_paid + total_m_paid))

        # Outstanding penalties across active loans
        total_pen_assessed = (
            LedgerTx.objects
            .filter(tenant=tenant, loan__status='ACTIVE', transaction_type='PENALTY_ASSESSMENT')
            .aggregate(total=models.Sum('amount_paise'))['total'] or 0
        )
        total_pen_paid = (
            LedgerTx.objects
            .filter(tenant=tenant, loan__status='ACTIVE', transaction_type='COLLECTION')
            .aggregate(total=models.Sum('allocated_penalty_paise'))['total'] or 0
        )
        total_pen_waived = (
            LedgerTx.objects
            .filter(tenant=tenant, loan__status='ACTIVE', transaction_type='REVERSAL')
            .aggregate(total=models.Sum('forgiven_penalty_paise'))['total'] or 0
        )
        outstanding_penalty = max(0, total_pen_assessed - total_pen_paid - total_pen_waived)

        loan_details = []
        outstanding_bullet_principal = 0
        for l in loans:
            l_kists = l.schedules.all()
            l_due = sum(k.total_due_paise for k in l_kists)
            l_paid = sum(k.principal_paid_paise + k.markup_paid_paise for k in l_kists)
            rem_sched = max(0, l_due - l_paid)

            rem_bullet_p = 0
            if l.product_type == 'bullet' and l.status == 'ACTIVE':
                p_paid = (
                    LedgerTx.objects
                    .filter(loan=l, transaction_type='COLLECTION')
                    .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
                )
                rem_bullet_p = max(0, l.principal_paise - p_paid)
                outstanding_bullet_principal += rem_bullet_p

            rem_pen = 0
            if l.status == 'ACTIVE':
                l_pen_assessed = (
                    LedgerTx.objects
                    .filter(loan=l, transaction_type='PENALTY_ASSESSMENT')
                    .aggregate(total=models.Sum('amount_paise'))['total'] or 0
                )
                l_pen_paid = (
                    LedgerTx.objects
                    .filter(loan=l, transaction_type='COLLECTION')
                    .aggregate(total=models.Sum('allocated_penalty_paise'))['total'] or 0
                )
                l_pen_waived = (
                    LedgerTx.objects
                    .filter(loan=l, transaction_type='REVERSAL')
                    .aggregate(total=models.Sum('forgiven_penalty_paise'))['total'] or 0
                )
                rem_pen = max(0, l_pen_assessed - l_pen_paid - l_pen_waived)

            total_loan_outstanding = rem_sched + rem_bullet_p + rem_pen
            loan_details.append({
                'id': str(l.id),
                'status': l.status,
                'principal_paise': l.principal_paise,
                'outstanding_balance_paise': total_loan_outstanding
            })

        return Response({
            'active_loans_count': active_loans_count,
            'settled_loans_count': settled_loans_count,
            'written_off_loans_count': written_off_loans_count,
            'total_loans_count': total_loans_count,
            'total_principal_paise': total_principal_paise,
            'total_collections_paise': total_collections_paise,
            'total_collections_count': total_collections_count,
            'total_waivers_paise': total_waivers_paise,
            'total_outstanding_balance_paise': outstanding_schedule_balance + outstanding_bullet_principal + outstanding_penalty,
            'loans': loan_details
        }, status=status.HTTP_200_OK)

