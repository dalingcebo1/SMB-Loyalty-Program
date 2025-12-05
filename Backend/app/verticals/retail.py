from typing import List, Dict, Any, Optional
from fastapi import APIRouter
from sqlalchemy.orm import Session
from .base import VerticalModule

class RetailVertical(VerticalModule):
    @property
    def vertical_key(self) -> str:
        return "retail"
    
    @property
    def display_name(self) -> str:
        return "Retail"
    
    def get_features(self) -> List[str]:
        return ["point_of_sale", "inventory", "customer_loyalty"]
        
    def on_redemption_success(self, db: Session, redemption: Any) -> Optional[Dict[str, Any]]:
        # Retail specific logic after redemption
        return {
            "type": "RETAIL_POST_REDEMPTION",
            "payload": {
                "redemption_id": redemption.id,
                "reward_name": redemption.reward_name,
                "message": "Please verify inventory stock."
            }
        }
