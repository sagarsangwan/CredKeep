import uuid
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.db.models import F, Q, CheckConstraint, UniqueConstraint

class Borrower(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='borrowers'
    )
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            UniqueConstraint(fields=['tenant', 'phone'], name='unique_tenant_borrower_phone')
        ]

    def __str__(self):
        return f"{self.name} ({self.phone})"


class LoanAccount(models.Model):
    PRODUCT_TYPES = [
        ('instalment', 'Instalment'),
        ('bullet', 'Bullet'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SETTLED', 'Settled'),
        ('WRITTEN_OFF', 'Written Off'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='loans'
    )
    borrower = models.ForeignKey(
        Borrower,
        on_delete=models.RESTRICT,
        related_name='loans'
    )
    principal_paise = models.BigIntegerField()
    markup_factor = models.DecimalField(max_digits=6, decimal_places=4)
    term_months = models.PositiveIntegerField()
    start_date = models.DateField()
    due_day = models.PositiveSmallIntegerField()
    product_type = models.CharField(max_length=32, choices=PRODUCT_TYPES)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            CheckConstraint(condition=Q(principal_paise__gt=0), name='check_loan_positive_principal'),
            CheckConstraint(condition=Q(due_day__gte=1) & Q(due_day__lte=31), name='check_loan_valid_due_day'),
            CheckConstraint(condition=Q(term_months__gt=0), name='check_loan_positive_term'),
        ]

    def __str__(self):
        return f"Loan {self.id} - {self.product_type} ({self.status})"


class Kist(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='kists'
    )
    loan = models.ForeignKey(
        LoanAccount,
        on_delete=models.RESTRICT,
        related_name='schedules'
    )
    installment_number = models.PositiveIntegerField()
    original_due_date = models.DateField()
    effective_due_date = models.DateField()
    principal_component_paise = models.BigIntegerField(default=0)
    markup_component_paise = models.BigIntegerField(default=0)
    total_due_paise = models.BigIntegerField()
    principal_paid_paise = models.BigIntegerField(default=0)
    markup_paid_paise = models.BigIntegerField(default=0)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='PENDING')

    class Meta:
        ordering = ['loan', 'installment_number']
        constraints = [
            UniqueConstraint(fields=['loan', 'installment_number'], name='unique_loan_installment'),
            CheckConstraint(condition=Q(principal_paid_paise__gte=0), name='check_kist_principal_paid_non_negative'),
            CheckConstraint(condition=Q(markup_paid_paise__gte=0), name='check_kist_markup_paid_non_negative'),
        ]

    def __str__(self):
        return f"Kist #{self.installment_number} for Loan {self.loan_id} ({self.status})"


class TransactionQuerySet(models.QuerySet):
    def delete(self):
        raise ValidationError("Transaction records are append-only: bulk deletions are prohibited.")


class Transaction(models.Model):
    objects = TransactionQuerySet.as_manager()

    TRANSACTION_TYPES = [
        ('COLLECTION', 'Collection'),
        ('PENALTY_ASSESSMENT', 'Penalty Assessment'),
        ('REVERSAL', 'Reversal'),
    ]
    PAYMENT_METHODS = [
        ('CASH', 'Cash'),
        ('UPI', 'UPI'),
        ('BANK_TRANSFER', 'Bank Transfer'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    operation_id = models.UUIDField(db_index=True)
    loan = models.ForeignKey(
        LoanAccount,
        on_delete=models.RESTRICT,
        related_name='transactions'
    )
    sequence_number = models.BigIntegerField(db_index=True, blank=True, null=True)
    transaction_type = models.CharField(max_length=32, choices=TRANSACTION_TYPES)
    is_cash = models.BooleanField(default=True)
    payment_method = models.CharField(max_length=32, choices=PAYMENT_METHODS, default='CASH')
    amount_paise = models.BigIntegerField(default=0)
    allocated_principal_paise = models.BigIntegerField(default=0)
    allocated_markup_paise = models.BigIntegerField(default=0)
    allocated_penalty_paise = models.BigIntegerField(default=0)
    unallocated_surplus_paise = models.BigIntegerField(default=0)
    forgiven_principal_paise = models.BigIntegerField(default=0)
    forgiven_markup_paise = models.BigIntegerField(default=0)
    forgiven_penalty_paise = models.BigIntegerField(default=0)
    effective_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['tenant', 'sequence_number']
        constraints = [
            UniqueConstraint(fields=['tenant', 'operation_id'], name='unique_tenant_transaction_operation'),
            CheckConstraint(condition=Q(amount_paise__gte=0), name='check_transaction_amount_non_negative'),
            CheckConstraint(
                condition=Q(
                    allocated_principal_paise__gte=0,
                    allocated_markup_paise__gte=0,
                    allocated_penalty_paise__gte=0,
                    unallocated_surplus_paise__gte=0,
                ),
                name='check_transaction_allocations_non_negative'
            ),
        ]

    def clean(self):
        super().clean()
        if self.transaction_type == 'COLLECTION':
            allocated_total = (
                self.allocated_principal_paise +
                self.allocated_markup_paise +
                self.allocated_penalty_paise +
                self.unallocated_surplus_paise
            )
            if allocated_total != self.amount_paise:
                raise ValidationError(
                    f"Conservation violation: sum of allocations ({allocated_total}) "
                    f"must equal payment amount ({self.amount_paise})."
                )

    def save(self, *args, **kwargs):
        # Enforce append-only ledger immutability
        if not self._state.adding and Transaction.objects.filter(pk=self.pk).exists():
            raise ValidationError("Transaction records are append-only: updates are prohibited.")
        
        self.full_clean()

        if self.sequence_number is None:
            # Atomic per-tenant sequence assignment
            with transaction.atomic():
                last = (
                    Transaction.objects
                    .select_for_update()
                    .filter(tenant=self.tenant)
                    .order_by('-sequence_number')
                    .first()
                )
                self.sequence_number = (last.sequence_number + 1) if (last and last.sequence_number) else 1
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Transaction records are append-only: deletions are prohibited.")

    def __str__(self):
        return f"{self.transaction_type} #{self.sequence_number} on Loan {self.loan_id} ({self.amount_paise}p)"


class ScheduleModification(models.Model):
    PENALTY_ACTIONS = [
        ('NONE', 'None'),
        ('WAIVE', 'Waive'),
        ('CAP', 'Cap'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='schedule_modifications'
    )
    loan = models.ForeignKey(
        LoanAccount,
        on_delete=models.RESTRICT,
        related_name='modifications'
    )
    kist = models.ForeignKey(
        Kist,
        on_delete=models.RESTRICT,
        related_name='modifications'
    )
    operation_id = models.UUIDField(db_index=True)
    original_due_date = models.DateField()
    prior_effective_due_date = models.DateField()
    revised_effective_due_date = models.DateField()
    reason = models.TextField(blank=True, default='')
    accrued_penalty_action = models.CharField(max_length=32, choices=PENALTY_ACTIONS, default='NONE')
    waived_penalty_paise = models.BigIntegerField(default=0)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']
        constraints = [
            UniqueConstraint(fields=['tenant', 'operation_id'], name='unique_tenant_modification_operation')
        ]

    def __str__(self):
        return f"Mod for Loan {self.loan_id} Kist {self.kist_id} -> {self.revised_effective_due_date}"


class SyncLog(models.Model):
    STATUS_CHOICES = [
        ('ACCEPTED', 'Accepted'),
        ('REJECTED', 'Rejected'),
        ('NEEDS_REVIEW', 'Needs Review'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='sync_logs'
    )
    device = models.ForeignKey(
        'tenants.Device',
        on_delete=models.CASCADE,
        related_name='sync_logs'
    )
    operation_id = models.UUIDField(db_index=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES)
    error_message = models.TextField(blank=True, default='')
    server_timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-server_timestamp']
        constraints = [
            UniqueConstraint(fields=['tenant', 'operation_id'], name='unique_tenant_synclog_operation')
        ]

    def __str__(self):
        return f"SyncLog {self.operation_id} ({self.status}) for Device {self.device_id}"


class SyncOutbox(models.Model):
    OPERATION_TYPES = [
        ('INSERT', 'Insert'),
        ('UPDATE', 'Update'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='outbox_records'
    )
    record_type = models.CharField(max_length=64)
    record_id = models.UUIDField()
    operation_type = models.CharField(max_length=32, choices=OPERATION_TYPES)
    payload = models.JSONField()
    sequence_number = models.BigIntegerField(db_index=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sequence_number']
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'sequence_number'], name='unique_tenant_outbox_sequence')
        ]

    def save(self, *args, **kwargs):
        if self.sequence_number is None:
            from tenants.models import Tenant
            with transaction.atomic():
                tenant_row = Tenant.objects.select_for_update().get(id=self.tenant_id)
                tenant_row.outbox_sequence_counter += 1
                tenant_row.save(update_fields=['outbox_sequence_counter'])
                self.sequence_number = tenant_row.outbox_sequence_counter
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"Outbox #{self.sequence_number}: {self.record_type} {self.record_id} ({self.operation_type})"
