"""
Provider Health Check and Webhook Routes

Provides:
- Health check endpoints for SMS/Email providers
- Webhook handlers for delivery status updates
- Provider status monitoring
"""

import logging
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.external import get_twilio_service, get_sendgrid_service
from app.vertical_models.campaigns import CampaignRecipient

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Health Check Schemas
# ============================================================================

class ProviderStatus(BaseModel):
    """Provider health status."""
    provider: str
    configured: bool
    available: bool
    details: Dict[str, Any]


class SystemHealthResponse(BaseModel):
    """System health check response."""
    status: str
    providers: Dict[str, ProviderStatus]
    timestamp: str


# ============================================================================
# Health Check Endpoints
# ============================================================================

@router.get("/health", response_model=SystemHealthResponse)
async def check_providers_health():
    """
    Check health of all external providers.
    
    Returns status of:
    - Twilio (SMS)
    - SendGrid (Email)
    """
    twilio = get_twilio_service()
    sendgrid = get_sendgrid_service()
    
    twilio_status = {
        'provider': 'twilio',
        'configured': twilio is not None,
        'available': False,
        'details': {}
    }
    
    if twilio:
        try:
            # Simple validation - check client initialization
            twilio_status['available'] = True
            twilio_status['details'] = {
                'from_phone': twilio.from_phone,
                'status': 'operational'
            }
        except Exception as e:
            logger.error(f"Twilio health check failed: {str(e)}")
            twilio_status['details'] = {'error': str(e)}
    else:
        twilio_status['details'] = {'error': 'Not configured - set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'}
    
    sendgrid_status = {
        'provider': 'sendgrid',
        'configured': sendgrid is not None,
        'available': False,
        'details': {}
    }
    
    if sendgrid:
        try:
            sendgrid_status['available'] = True
            sendgrid_status['details'] = {
                'from_email': sendgrid.from_email,
                'from_name': sendgrid.from_name,
                'status': 'operational'
            }
        except Exception as e:
            logger.error(f"SendGrid health check failed: {str(e)}")
            sendgrid_status['details'] = {'error': str(e)}
    else:
        sendgrid_status['details'] = {'error': 'Not configured - set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL'}
    
    overall_status = 'healthy' if (twilio_status['available'] or sendgrid_status['available']) else 'degraded'
    
    return SystemHealthResponse(
        status=overall_status,
        providers={
            'sms': twilio_status,
            'email': sendgrid_status
        },
        timestamp=datetime.utcnow().isoformat()
    )


# ============================================================================
# Webhook Endpoints
# ============================================================================

@router.post("/webhooks/twilio/status")
async def twilio_status_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle Twilio delivery status webhooks.
    
    Twilio POSTs to this endpoint when message status changes:
    - queued, sent, delivered, failed, undelivered
    
    Updates CampaignRecipient records with delivery status.
    """
    try:
        form_data = await request.form()
        webhook_data = dict(form_data)
        
        logger.info(f"Twilio webhook received: {webhook_data.get('MessageStatus')}")
        
        twilio = get_twilio_service()
        if not twilio:
            logger.warning("Twilio not configured but webhook received")
            return {"status": "ignored", "reason": "Twilio not configured"}
        
        # Parse webhook data
        parsed = twilio.process_webhook(webhook_data)
        
        message_sid = parsed['message_sid']
        status = parsed['status']
        error_code = parsed['error_code']
        
        # Find recipient by provider_message_id
        recipient = db.query(CampaignRecipient).filter(
            CampaignRecipient.provider_message_id == message_sid
        ).first()
        
        if not recipient:
            logger.warning(f"Recipient not found for Twilio message {message_sid}")
            return {"status": "ignored", "reason": "Recipient not found"}
        
        # Update delivery status
        if status == 'delivered':
            recipient.delivered_at = datetime.utcnow()
        elif status in ['failed', 'undelivered']:
            recipient.failed_at = datetime.utcnow()
            recipient.error_message = parsed.get('error_message') or f"Error code: {error_code}"
        
        db.commit()
        
        logger.info(f"Updated recipient {recipient.id} status to {status}")
        
        return {"status": "processed", "message_sid": message_sid}
        
    except Exception as e:
        logger.error(f"Twilio webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhooks/sendgrid/events")
async def sendgrid_events_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle SendGrid event webhooks.
    
    SendGrid POSTs array of events:
    - delivered, open, click, bounce, spam_report, unsubscribe
    
    Updates CampaignRecipient records with engagement data.
    """
    try:
        events = await request.json()
        
        if not isinstance(events, list):
            events = [events]
        
        logger.info(f"SendGrid webhook received: {len(events)} events")
        
        sendgrid = get_sendgrid_service()
        if not sendgrid:
            logger.warning("SendGrid not configured but webhook received")
            return {"status": "ignored", "reason": "SendGrid not configured"}
        
        processed = 0
        
        for event_data in events:
            # Parse event
            parsed = sendgrid.process_webhook(event_data)
            
            event = parsed['event']
            message_id = parsed['message_id']
            
            if not message_id:
                continue
            
            # Find recipient
            recipient = db.query(CampaignRecipient).filter(
                CampaignRecipient.provider_message_id == message_id
            ).first()
            
            if not recipient:
                logger.warning(f"Recipient not found for SendGrid message {message_id}")
                continue
            
            # Update based on event type
            if event == 'delivered':
                recipient.delivered_at = datetime.utcnow()
            elif event == 'open':
                if not recipient.opened_at:
                    recipient.opened_at = datetime.utcnow()
            elif event == 'click':
                if not recipient.clicked_at:
                    recipient.clicked_at = datetime.utcnow()
                # Track click URL
                if parsed.get('url'):
                    recipient.click_url = parsed['url']
            elif event in ['bounce', 'dropped', 'spam_report']:
                recipient.failed_at = datetime.utcnow()
                recipient.error_message = parsed.get('reason') or event
            elif event == 'unsubscribe':
                # Mark customer as opted out (TODO: update User model)
                logger.info(f"Customer {recipient.customer_id} unsubscribed")
            
            processed += 1
        
        db.commit()
        
        logger.info(f"Processed {processed}/{len(events)} SendGrid events")
        
        return {"status": "processed", "count": processed}
        
    except Exception as e:
        logger.error(f"SendGrid webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Testing Endpoints (Development Only)
# ============================================================================

@router.post("/test/sms")
async def test_sms_send(to_phone: str, message: str):
    """
    Test SMS sending (dev only).
    
    Send a test SMS to verify Twilio integration.
    """
    from config import settings
    
    if settings.environment == "production":
        raise HTTPException(status_code=403, detail="Test endpoint disabled in production")
    
    twilio = get_twilio_service()
    if not twilio:
        raise HTTPException(status_code=503, detail="Twilio not configured")
    
    try:
        result = twilio.send_sms(to_phone=to_phone, message=message)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Test SMS error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/email")
async def test_email_send(
    to_email: str,
    subject: str = "Test Email",
    message: str = "This is a test email from SMB Loyalty Platform"
):
    """
    Test email sending (dev only).
    
    Send a test email to verify SendGrid integration.
    """
    from config import settings
    
    if settings.environment == "production":
        raise HTTPException(status_code=403, detail="Test endpoint disabled in production")
    
    sendgrid = get_sendgrid_service()
    if not sendgrid:
        raise HTTPException(status_code=503, detail="SendGrid not configured")
    
    try:
        html_content = sendgrid.create_html_email(
            title=subject,
            heading=subject,
            body_text=f"<p>{message}</p>",
            footer_text="This is a test email. You can safely ignore it."
        )
        
        result = sendgrid.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content
        )
        
        return result
    except Exception as e:
        logger.error(f"Test email error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
