"""Base model utilities and mixins."""
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import Session, Query


class TenantScopedModel:
    """Mixin for models that belong to a tenant.

    Provides a ``tenant_id`` column and a convenience ``for_tenant()``
    class-method so callsites can avoid duplicating the filter logic.
    """

    tenant_id = Column(
        String,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @classmethod
    def for_tenant(cls, db: Session, tenant_id: str) -> Query:
        return db.query(cls).filter(cls.tenant_id == tenant_id)
