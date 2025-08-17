from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class DailyCount(BaseModel):
    date: str
    count: int

class DailyValue(BaseModel):
    date: str
    value: float

class TierDistributionItem(BaseModel):
    tier: str
    count: int

class TopRewardItem(BaseModel):
    title: str
    count: int
    

class AnalyticsSummaryResponse(BaseModel):
    user_count: int
    transaction_count: int
    points_issued: float
    points_redeemed: float
    redemptions_count: int
    user_growth: List[DailyCount]
    transaction_volume: List[DailyValue]
    tier_distribution: List[TierDistributionItem]
    visits_total: int
    visits_over_time: List[DailyCount]
    top_rewards: List[TopRewardItem]

    # Pydantic V2 config: allow building from ORM objects
    model_config = ConfigDict(from_attributes=True)
 
class PeakHour(BaseModel):
    hour: str
    count: int

class PeakDay(BaseModel):
    day: str
    count: int

class TransactionDetails(BaseModel):
    average_value: float
    per_user: float
    conversion_rate: float
    peak_hours: List[PeakHour]
    peak_days: List[PeakDay]
    model_config = ConfigDict(from_attributes=True)

class UserDetails(BaseModel):
    dau: int
    wau: int
    mau: int
    retention_rate: float
    churn_rate: float
    model_config = ConfigDict(from_attributes=True)
