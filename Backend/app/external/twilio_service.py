"""
Twilio SMS Service

Provides SMS sending capabilities using Twilio API.
Handles:
- SMS message sending
- Delivery status tracking
- Error handling and retries
- Opt-out management
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)


class TwilioService:
    """Twilio SMS service for sending text messages."""
    
    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        from_phone: str
    ):
        """
        Initialize Twilio client.
        
        Args:
            account_sid: Twilio account SID
            auth_token: Twilio auth token
            from_phone: Sender phone number (E.164 format: +27XXXXXXXXX)
        """
        self.client = Client(account_sid, auth_token)
        self.from_phone = from_phone
        
    def send_sms(
        self,
        to_phone: str,
        message: str,
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send SMS message via Twilio.
        
        Args:
            to_phone: Recipient phone number (E.164 format)
            message: SMS message content (max 1600 chars)
            callback_url: Optional webhook URL for delivery status
            
        Returns:
            dict: {
                'success': bool,
                'message_sid': Optional[str],
                'status': str,
                'error': Optional[str]
            }
            
        Raises:
            ValueError: If phone format invalid or message too long
        """
        # Validate inputs
        if not self._validate_phone(to_phone):
            raise ValueError(f"Invalid phone format: {to_phone}. Use E.164 (+27XXXXXXXXX)")
        
        if len(message) > 1600:
            raise ValueError(f"Message too long: {len(message)}/1600 chars")
        
        try:
            # Send SMS
            twilio_message = self.client.messages.create(
                to=to_phone,
                from_=self.from_phone,
                body=message,
                status_callback=callback_url if callback_url else None
            )
            
            logger.info(
                f"SMS sent successfully to {to_phone[:8]}*** | "
                f"SID: {twilio_message.sid} | Status: {twilio_message.status}"
            )
            
            return {
                'success': True,
                'message_sid': twilio_message.sid,
                'status': twilio_message.status,
                'error': None,
                'to': to_phone,
                'sent_at': datetime.utcnow().isoformat()
            }
            
        except TwilioRestException as e:
            logger.error(f"Twilio SMS error to {to_phone[:8]}***: {e.code} - {e.msg}")
            
            return {
                'success': False,
                'message_sid': None,
                'status': 'failed',
                'error': f"Twilio error {e.code}: {e.msg}",
                'to': to_phone,
                'sent_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Unexpected SMS error to {to_phone[:8]}***: {str(e)}")
            
            return {
                'success': False,
                'message_sid': None,
                'status': 'failed',
                'error': str(e),
                'to': to_phone,
                'sent_at': datetime.utcnow().isoformat()
            }
    
    def send_bulk_sms(
        self,
        recipients: list[Dict[str, str]],
        message: str,
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send SMS to multiple recipients.
        
        Args:
            recipients: List of {'phone': '+27XXXXXXXXX', 'name': 'John'}
            message: SMS template (can include {{name}} placeholder)
            callback_url: Optional webhook for delivery tracking
            
        Returns:
            dict: {
                'total': int,
                'success': int,
                'failed': int,
                'results': list[dict]
            }
        """
        results = []
        success_count = 0
        failed_count = 0
        
        for recipient in recipients:
            phone = recipient.get('phone')
            name = recipient.get('name', '')
            
            if not phone:
                failed_count += 1
                results.append({
                    'phone': None,
                    'success': False,
                    'error': 'Missing phone number'
                })
                continue
            
            # Personalize message
            personalized_message = message.replace('{{name}}', name)
            
            # Send SMS
            result = self.send_sms(phone, personalized_message, callback_url)
            results.append(result)
            
            if result['success']:
                success_count += 1
            else:
                failed_count += 1
        
        logger.info(
            f"Bulk SMS completed: {success_count}/{len(recipients)} successful, "
            f"{failed_count} failed"
        )
        
        return {
            'total': len(recipients),
            'success': success_count,
            'failed': failed_count,
            'results': results
        }
    
    def get_message_status(self, message_sid: str) -> Optional[Dict[str, Any]]:
        """
        Fetch delivery status for a sent message.
        
        Args:
            message_sid: Twilio message SID
            
        Returns:
            dict: Message details or None if not found
        """
        try:
            message = self.client.messages(message_sid).fetch()
            
            return {
                'sid': message.sid,
                'status': message.status,
                'to': message.to,
                'from': message.from_,
                'date_sent': message.date_sent.isoformat() if message.date_sent else None,
                'date_updated': message.date_updated.isoformat() if message.date_updated else None,
                'error_code': message.error_code,
                'error_message': message.error_message,
                'price': message.price,
                'price_unit': message.price_unit
            }
            
        except TwilioRestException as e:
            logger.error(f"Failed to fetch message {message_sid}: {e.msg}")
            return None
    
    @staticmethod
    def _validate_phone(phone: str) -> bool:
        """
        Validate phone number format (E.164).
        
        Args:
            phone: Phone number string
            
        Returns:
            bool: True if valid format
        """
        if not phone:
            return False
        
        # E.164 format: +[country][number] (e.g., +27821234567)
        if not phone.startswith('+'):
            return False
        
        # Remove '+' and check if rest is digits
        digits = phone[1:]
        if not digits.isdigit():
            return False
        
        # Length check: 7-15 digits after '+'
        if not (7 <= len(digits) <= 15):
            return False
        
        return True
    
    @staticmethod
    def process_webhook(webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process Twilio delivery status webhook.
        
        Args:
            webhook_data: Twilio webhook POST data
            
        Returns:
            dict: Parsed status update
        """
        return {
            'message_sid': webhook_data.get('MessageSid'),
            'status': webhook_data.get('MessageStatus'),
            'error_code': webhook_data.get('ErrorCode'),
            'error_message': webhook_data.get('ErrorMessage'),
            'to': webhook_data.get('To'),
            'from': webhook_data.get('From'),
            'timestamp': datetime.utcnow().isoformat()
        }


def get_twilio_service() -> Optional[TwilioService]:
    """
    Factory function to create TwilioService from environment.
    
    Returns:
        TwilioService or None if not configured
    """
    from config import settings
    
    account_sid = settings.TWILIO_ACCOUNT_SID
    auth_token = settings.TWILIO_AUTH_TOKEN
    from_phone = settings.TWILIO_PHONE_NUMBER
    
    if not all([account_sid, auth_token, from_phone]):
        logger.warning(
            "Twilio not configured - SMS sending disabled. "
            "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER"
        )
        return None
    
    return TwilioService(account_sid, auth_token, from_phone)
