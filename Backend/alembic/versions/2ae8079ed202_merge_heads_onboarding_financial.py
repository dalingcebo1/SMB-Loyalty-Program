"""merge_heads_onboarding_financial

Revision ID: 2ae8079ed202
Revises: 20260321_onboarding, c341012934cf
Create Date: 2026-03-21 15:36:38.379718

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2ae8079ed202'
down_revision: Union[str, None] = ('20260321_onboarding', 'c341012934cf')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
