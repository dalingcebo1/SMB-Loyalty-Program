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
    
class TopCustomerItem(BaseModel):
    user_id: int
    name: str
    total_washes: int
    completed_washes: int
    revenue_cents: int
    avg_spend_cents: int
    last_visit: Optional[str]
    loyalty_wash_count: int
    loyalty_share: float
    points_redeemed: int
    points_outstanding: int

class LoyaltyOverview(BaseModel):
    loyalty_penetration: float
    avg_points_redeemed_per_wash: float
    total_points_redeemed: int
    total_points_earned: int
    outstanding_points: int

class ChurnCandidate(BaseModel):
    user_id: int
    name: str
    days_since_last: int
    percentile: float
    churn_risk_flag: bool

class TopCustomersResponse(BaseModel):
    items: List[TopCustomerItem]
    total: int

class LoyaltyAnalyticsResponse(BaseModel):
    overview: LoyaltyOverview
    top_customers: List[TopCustomerItem]
    churn_candidates: List[ChurnCandidate]


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
