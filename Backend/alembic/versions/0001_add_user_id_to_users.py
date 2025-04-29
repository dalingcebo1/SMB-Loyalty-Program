"""Add integer PK column id to users

Revision ID: 0001_add_user_id_to_users
Revises: 
Create Date: 2025-04-29 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_add_user_id_to_users'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Drop FKs that reference users.phone
    op.drop_constraint('claimed_rewards_user_phone_fkey', 'claimed_rewards', type_='foreignkey')
    op.drop_constraint('pending_rewards_user_phone_fkey', 'pending_rewards', type_='foreignkey')
    op.drop_constraint('redeemed_rewards_user_phone_fkey', 'redeemed_rewards', type_='foreignkey')

    # 2) Add the new serial id column
    op.add_column(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False)
    )

    # 3) Replace the PK on phone with a PK on id
    op.drop_constraint('users_pkey', 'users', type_='primary')
    op.create_primary_key('users_pkey', 'users', ['id'])

    # 4) Recreate the foreign keys to users.phone
    op.create_foreign_key(
        'claimed_rewards_user_phone_fkey',
        'claimed_rewards', 'users',
        ['user_phone'], ['phone']
    )
    op.create_foreign_key(
        'pending_rewards_user_phone_fkey',
        'pending_rewards', 'users',
        ['user_phone'], ['phone']
    )
    op.create_foreign_key(
        'redeemed_rewards_user_phone_fkey',
        'redeemed_rewards', 'users',
        ['user_phone'], ['phone']
    )


def downgrade() -> None:
    # 1) Drop the restored FKs
    op.drop_constraint('redeemed_rewards_user_phone_fkey', 'redeemed_rewards', type_='foreignkey')
    op.drop_constraint('pending_rewards_user_phone_fkey', 'pending_rewards', type_='foreignkey')
    op.drop_constraint('claimed_rewards_user_phone_fkey', 'claimed_rewards', type_='foreignkey')

    # 2) Revert the PK back to phone
    op.drop_constraint('users_pkey', 'users', type_='primary')
    op.create_primary_key('users_pkey', 'users', ['phone'])

    # 3) Remove the id column
    op.drop_column('users', 'id')

    # 4) Recreate the original FKs (they pointed to users.phone)
    op.create_foreign_key(
        'claimed_rewards_user_phone_fkey',
        'claimed_rewards', 'users',
        ['user_phone'], ['phone']
    )
    op.create_foreign_key(
        'pending_rewards_user_phone_fkey',
        'pending_rewards', 'users',
        ['user_phone'], ['phone']
    )
    op.create_foreign_key(
        'redeemed_rewards_user_phone_fkey',
        'redeemed_rewards', 'users',
        ['user_phone'], ['phone']
    )
