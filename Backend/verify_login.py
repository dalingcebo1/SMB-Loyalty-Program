#!/usr/bin/env python3
"""Quick login verification test for seeded users."""
import os
import sys

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from app.core.database import SessionLocal
from app.models import User
from app.plugins.auth.routes import verify_password, get_password_hash

TEST_CREDENTIALS = [
    ("dali.ngubane@chaosx.co.za", "It7742001", "admin"),
    ("smblptest@gmail.com", "It7742001", "admin"),
    ("dali.ngubane@gmail.com", "It7742001", "staff"),
]

def verify_users():
    """Verify all test users exist and passwords work."""
    print("\n🔐 Testing User Authentication\n" + "="*50)
    
    with SessionLocal() as session:
        all_good = True
        for email, password, expected_role in TEST_CREDENTIALS:
            user = session.query(User).filter_by(email=email).first()
            
            if not user:
                print(f"❌ {email:<35} NOT FOUND")
                all_good = False
                continue
            
            # Test password
            password_valid = verify_password(password, user.hashed_password)
            role_match = user.role == expected_role
            onboarded = user.onboarded
            
            status = "✅" if (password_valid and role_match and onboarded) else "❌"
            details = f"role={user.role}, onboarded={onboarded}, pwd={'✓' if password_valid else '✗'}"
            
            print(f"{status} {email:<35} {details}")
            
            if not (password_valid and role_match and onboarded):
                all_good = False
    
    print("="*50)
    if all_good:
        print("✅ All users verified successfully!")
        print("\n📝 Login credentials:")
        print("   Email: dali.ngubane@chaosx.co.za or smblptest@gmail.com")
        print("   Password: It7742001")
        return 0
    else:
        print("❌ Some users failed verification")
        return 1

if __name__ == "__main__":
    exit(verify_users())
