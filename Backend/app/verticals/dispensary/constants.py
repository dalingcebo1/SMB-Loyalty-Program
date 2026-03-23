"""Dispensary vertical constants."""

from enum import Enum


class StrainType(str, Enum):
    INDICA = "indica"
    SATIVA = "sativa"
    HYBRID = "hybrid"


# Purchase limits
DEFAULT_DAILY_LIMIT_GRAMS = 28.0   # 1 oz per day
DEFAULT_MONTHLY_LIMIT_GRAMS = 150.0  # 150g per month

# Tax
DEFAULT_TAX_RATE = 0.15  # 15%

# Sale number prefix
SALE_NUMBER_PREFIX = "DSP"
