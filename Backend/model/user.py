from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
