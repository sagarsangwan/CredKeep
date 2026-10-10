import uuid
from decimal import Decimal
from django.db import transaction
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
                device, _ = Device.objects.get_or_create(
                    id=dev_uuid,
                    tenant=tenant,
                    defaults={'last_sync': timezone.now()}
                )
            except (ValueError, TypeError):
                pass

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

                    SyncLog.objects.create(
                        tenant=tenant,
                        device=device,
                        operation_id=operation_id,
                        status=res_status,
                        error_message=err_msg or ''
                    )

                    res_item = {
                        "operation_id": str(operation_id),
                        "status": res_status,
                    }
                    if err_msg:
                        res_item["error"] = err_msg
                    results.append(res_item)

            except Exception as e:
                # Top-level failure for this operation: record REJECTED
                err_text = str(e)
                SyncLog.objects.create(
                    tenant=tenant,
                    device=device,
                    operation_id=operation_id,
                    status='REJECTED',
                    error_message=err_text
                )
                results.append({
                    "operation_id": str(operation_id),
                    "status": "REJECTED",
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

            principal_paise = int(payload.get('principal_paise', 0))
            markup_factor = Decimal(str(payload.get('markup_factor', '0')))
            term_months = int(payload.get('term_months', 0))
            start_date = str(payload.get('start_date', ''))
            due_day = int(payload.get('due_day', 1))
            product_type = payload.get('product_type', 'instalment')

            if principal_paise <= 0 or term_months <= 0 or not start_date:
                return 'REJECTED', 'Invalid loan parameters (principal, term, or start_date).'

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
            return 'ACCEPTED', None

        elif op_type == 'record_collection':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            # Stale update check: settled or written off loans require review
            if loan.status in ('SETTLED', 'WRITTEN_OFF'):
                return 'NEEDS_REVIEW', f'Loan {loan.id} is already settled or written off.'

            amount_paise = int(payload.get('amount_paise', 0))
            if amount_paise <= 0:
                return 'REJECTED', 'Payment amount must be greater than zero.'

            effective_date = (
                payload.get('effective_date') or
                op.get('timestamp') or
                str(timezone.now().date())
            )
            if isinstance(effective_date, str) and 'T' in effective_date:
                effective_date = effective_date.split('T')[0]

            payment_method = payload.get('payment_method', 'CASH').upper()
            is_cash = payload.get('is_cash', payment_method == 'CASH')

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
                loan = LoanAccount.objects.get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
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

            ScheduleModification.objects.create(
                tenant=tenant,
                loan=loan,
                kist=kist,
                operation_id=operation_id,
                original_due_date=kist.original_due_date,
                prior_effective_due_date=kist.effective_due_date,
                revised_effective_due_date=revised_date,
                reason=payload.get('reason', ''),
                accrued_penalty_action=payload.get('accrued_penalty_action', 'NONE'),
                waived_penalty_paise=int(payload.get('waived_penalty_paise', 0))
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
            return 'ACCEPTED', None

        elif op_type == 'waive_penalty':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            waive_amount = int(payload.get('amount_paise', 0))
            if waive_amount <= 0:
                return 'REJECTED', 'Waiver amount must be greater than zero.'

            eff_date = str(payload.get('effective_date') or timezone.now().date())
            if 'T' in eff_date:
                eff_date = eff_date.split('T')[0]

            tx = LedgerTx.objects.create(
                tenant=tenant,
                operation_id=operation_id,
                loan=loan,
                transaction_type='REVERSAL',
                amount_paise=0,
                forgiven_penalty_paise=waive_amount,
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
