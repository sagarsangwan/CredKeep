from django.contrib import admin
from .models import (
    Borrower,
    LoanAccount,
    Kist,
    Transaction,
    ScheduleModification,
    SyncLog,
    SyncOutbox,
)

@admin.register(Borrower)
class BorrowerAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'phone', 'tenant', 'created_at')
    search_fields = ('name', 'phone')
    list_filter = ('tenant',)

@admin.register(LoanAccount)
class LoanAccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'borrower', 'product_type', 'principal_paise', 'status', 'tenant', 'created_at')
    list_filter = ('product_type', 'status', 'tenant')

@admin.register(Kist)
class KistAdmin(admin.ModelAdmin):
    list_display = ('id', 'loan', 'installment_number', 'effective_due_date', 'total_due_paise', 'status', 'tenant')
    list_filter = ('status', 'tenant')

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'sequence_number', 'loan', 'transaction_type', 'amount_paise', 'effective_date', 'tenant')
    list_filter = ('transaction_type', 'payment_method', 'tenant')
    readonly_fields = ('id', 'sequence_number', 'created_at')

@admin.register(ScheduleModification)
class ScheduleModificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'loan', 'kist', 'revised_effective_due_date', 'accrued_penalty_action', 'tenant')
    list_filter = ('accrued_penalty_action', 'tenant')

@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'device', 'operation_id', 'status', 'server_timestamp', 'tenant')
    list_filter = ('status', 'tenant')

@admin.register(SyncOutbox)
class SyncOutboxAdmin(admin.ModelAdmin):
    list_display = ('id', 'sequence_number', 'record_type', 'record_id', 'operation_type', 'tenant', 'created_at')
    list_filter = ('record_type', 'operation_type', 'tenant')
