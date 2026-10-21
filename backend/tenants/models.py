import uuid
from django.db import models
from django.conf import settings

class Tenant(models.Model):
    """
    Represents a single lender's isolated workspace.
    In V2, this is a strict 1:1 relationship with the owner user.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_tenant'
    )
    outbox_sequence_counter = models.BigIntegerField(default=0)
    transaction_sequence_counter = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Device(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='devices')
    push_token = models.CharField(max_length=255, blank=True, null=True)
    last_sync = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Device {self.id} for {self.tenant.name}"


class GoogleIdentity(models.Model):
    """
    Links a user to an immutable Google subject (sub) identifier.
    Guarantees account integrity and prevents account takeover via matching email.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='google_identity'
    )
    google_sub = models.CharField(max_length=255, unique=True, db_index=True)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"GoogleIdentity({self.user.username}, sub={self.google_sub})"
