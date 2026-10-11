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
            device = Device.objects.filter(tenant=tenant).first()
            if not device:
                device = Device.objects.create(tenant=tenant, last_sync=timezone.now())
            else:
                device.last_sync = timezone.now()
                device.save(update_fields=['last_sync'])

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

            # Idempotency check against SyncLog
            existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
            if existing_log:
                res_item = {
                    "operation_id": str(operation_id),
                    "status": existing_log.status,
                }
                if existing_log.error_message:
                    res_item["error"] = existing_log.error_message
                results.append(res_item)
                continue

            op_type = op.get('type')
            payload = op.get('payload', {})
            if not isinstance(payload, dict):
                payload = {}

            try:
                with transaction.atomic():
                    res_status, err_msg = self._process_operation(
                        tenant=tenant,
                        device=device,
                        operation_id=operation_id,
                        op_type=op_type,
                        op=op,
                        payload=payload
                    )

                    try:
                        SyncLog.objects.create(
                            tenant=tenant,
                            device=device,
                            operation_id=operation_id,
                            status=res_status,
                            error_message=err_msg or ''
                        )
                    except IntegrityError:
                        existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
                        if existing_log:
                            res_status = existing_log.status
                            err_msg = existing_log.error_message

                    res_item = {
                        "operation_id": str(operation_id),
                        "status": res_status,
                    }
                    if err_msg:
                        res_item["error"] = err_msg
                    results.append(res_item)

            except ValidationError as e:
                err_text = str(e)
                existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
                if existing_log:
                    results.append({
                        "operation_id": str(operation_id),
                        "status": existing_log.status,
                        "error": existing_log.error_message or None
                    })
                else:
                    try:
                        SyncLog.objects.create(
                            tenant=tenant,
                            device=device,
                            operation_id=operation_id,
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
                existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
                if existing_log:
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

        return Response({"results": results}, status=status.HTTP_200_OK)

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
            borrower_id = uuid.UUID(str(borrower_id_raw)) if borrower_id_raw else uuid.uuid4()

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
            loan_id = uuid.UUID(str(loan_id_raw)) if loan_id_raw else uuid.uuid4()

            raw_principal = payload.get('principal_paise')
            if raw_principal is None or isinstance(raw_principal, bool) or not isinstance(raw_principal, int) or raw_principal <= 0:
                return 'REJECTED', 'principal_paise must be an exact positive integer in paise.'
            principal_paise = raw_principal

            try:
                markup_factor = Decimal(str(payload.get('markup_factor', '0')))
                if markup_factor.is_nan() or markup_factor.is_infinite() or markup_factor < 0:
                    return 'REJECTED', 'markup_factor must be a finite non-negative number.'
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
                status='ACTIVE'
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

            payment_method = payload.get('payment_method', 'CASH').upper()
            is_cash = payload.get('is_cash', payment_method == 'CASH')

            # Failure Matrix invariant: Money received on settled loan is recorded, marked as surplus, and loan remains settled.
            if loan.status in ('SETTLED', 'WRITTEN_OFF'):
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
            # from evading accrued late fees by backdating offline collection timestamps.
            server_date_str = str(timezone.now().date())
            assess_date_str = max(str(effective_date), server_date_str)
            ledger_service.assess_penalties(loan, assess_date_str)

            ledger_service.record_collection(
                loan=loan,
                payment_amount=amount_paise,
                operation_id=operation_id,
                effective_date_str=str(effective_date),
                payment_method=payment_method,
                is_cash=is_cash
            )
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
                kist = Kist.objects.filter(tenant=tenant, loan=loan, id=uuid.UUID(str(payload['kist_id']))).first()
            elif payload.get('installment_number'):
                kist = Kist.objects.filter(tenant=tenant, loan=loan, installment_number=int(payload['installment_number'])).first()

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

            # Unconditionally assess penalties through effective modification date before changing schedule due date
            eff_today = payload.get('effective_date')
            if not eff_today and op.get('timestamp'):
                eff_today = str(op['timestamp'])
            if not eff_today:
                eff_today = str(timezone.now().date())
            eff_today = str(eff_today)
            if 'T' in eff_today:
                eff_today = eff_today.split('T')[0]
            ledger_service.assess_penalties(loan, eff_today)

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

            eff_date = str(payload.get('effective_date') or timezone.now().date())
            if 'T' in eff_date:
                eff_date = eff_date.split('T')[0]

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
