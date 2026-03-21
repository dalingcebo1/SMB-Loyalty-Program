"""add_retail_inventory_models

Revision ID: ca0cb8108df7
Revises: f547a43c4eef
Create Date: 2026-02-05 09:33:49.719989

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca0cb8108df7'
down_revision: Union[str, None] = 'f547a43c4eef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op: vertical_features already added by f547a43c4eef."""
    pass


def downgrade() -> None:
    """No-op: vertical_features is owned by f547a43c4eef."""
    pass
