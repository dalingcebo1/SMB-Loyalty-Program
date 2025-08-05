from pydantic import BaseModel
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

    class Config:
        orm_mode = True
