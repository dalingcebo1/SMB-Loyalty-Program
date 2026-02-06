"""
SendGrid Email Service

Provides email sending capabilities using SendGrid API.
Handles:
- Transactional emails
- Marketing email campaigns
- Email templates
- Delivery tracking
- Open/click tracking
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Mail, Email, To, Content, Personalization, Attachment,
    FileContent, FileName, FileType, Disposition
)
from python_http_client.exceptions import HTTPError

logger = logging.getLogger(__name__)


class SendGridService:
    """SendGrid email service for sending emails."""
    
    def __init__(self, api_key: str, from_email: str, from_name: str = "SMB Loyalty"):
        """
        Initialize SendGrid client.
        
        Args:
            api_key: SendGrid API key
            from_email: Sender email address
            from_name: Sender display name
        """
        self.client = SendGridAPIClient(api_key)
        self.from_email = from_email
        self.from_name = from_name
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None,
        to_name: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        track_open: bool = True,
        track_click: bool = True
    ) -> Dict[str, Any]:
        """
        Send single email via SendGrid.
        
        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_content: HTML email body
            plain_content: Plain text fallback (auto-generated if None)
            to_name: Recipient name
            reply_to: Reply-to email address
            attachments: List of {'filename': str, 'content': bytes, 'type': str}
            track_open: Enable open tracking
            track_click: Enable click tracking
            
        Returns:
            dict: {
                'success': bool,
                'message_id': Optional[str],
                'status_code': int,
                'error': Optional[str]
            }
        """
        try:
            # Create message
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email, to_name),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            # Add plain text fallback
            if plain_content:
                message.add_content(Content("text/plain", plain_content))
            
            # Set reply-to
            if reply_to:
                message.reply_to = Email(reply_to)
            
            # Add attachments
            if attachments:
                for att in attachments:
                    attachment = Attachment()
                    attachment.file_content = FileContent(att['content'])
                    attachment.file_name = FileName(att['filename'])
                    attachment.file_type = FileType(att.get('type', 'application/octet-stream'))
                    attachment.disposition = Disposition('attachment')
                    message.add_attachment(attachment)
            
            # Tracking settings
            message.tracking_settings = {
                'click_tracking': {'enable': track_click},
                'open_tracking': {'enable': track_open}
            }
            
            # Send email
            response = self.client.send(message)
            
            message_id = response.headers.get('X-Message-Id')
            
            logger.info(
                f"Email sent to {to_email} | "
                f"Subject: {subject[:50]} | "
                f"Message ID: {message_id} | "
                f"Status: {response.status_code}"
            )
            
            return {
                'success': True,
                'message_id': message_id,
                'status_code': response.status_code,
                'error': None,
                'to': to_email,
                'sent_at': datetime.utcnow().isoformat()
            }
            
        except HTTPError as e:
            logger.error(f"SendGrid HTTP error to {to_email}: {e.status_code} - {e.body}")
            
            return {
                'success': False,
                'message_id': None,
                'status_code': e.status_code if hasattr(e, 'status_code') else 500,
                'error': str(e.body if hasattr(e, 'body') else e),
                'to': to_email,
                'sent_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Unexpected email error to {to_email}: {str(e)}")
            
            return {
                'success': False,
                'message_id': None,
                'status_code': 500,
                'error': str(e),
                'to': to_email,
                'sent_at': datetime.utcnow().isoformat()
            }
    
    def send_bulk_email(
        self,
        recipients: List[Dict[str, str]],
        subject: str,
        html_template: str,
        plain_template: Optional[str] = None,
        track_open: bool = True,
        track_click: bool = True
    ) -> Dict[str, Any]:
        """
        Send personalized emails to multiple recipients.
        
        Args:
            recipients: List of {'email': str, 'name': str, ...personalization_data}
            subject: Email subject (supports {{variable}} placeholders)
            html_template: HTML template with {{variable}} placeholders
            plain_template: Plain text template
            track_open: Enable open tracking
            track_click: Enable click tracking
            
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
            email = recipient.get('email')
            name = recipient.get('name', '')
            
            if not email:
                failed_count += 1
                results.append({
                    'email': None,
                    'success': False,
                    'error': 'Missing email address'
                })
                continue
            
            # Personalize content
            personalized_html = self._personalize(html_template, recipient)
            personalized_subject = self._personalize(subject, recipient)
            personalized_plain = self._personalize(plain_template, recipient) if plain_template else None
            
            # Send email
            result = self.send_email(
                to_email=email,
                subject=personalized_subject,
                html_content=personalized_html,
                plain_content=personalized_plain,
                to_name=name,
                track_open=track_open,
                track_click=track_click
            )
            
            results.append(result)
            
            if result['success']:
                success_count += 1
            else:
                failed_count += 1
        
        logger.info(
            f"Bulk email completed: {success_count}/{len(recipients)} successful, "
            f"{failed_count} failed"
        )
        
        return {
            'total': len(recipients),
            'success': success_count,
            'failed': failed_count,
            'results': results
        }
    
    def send_template_email(
        self,
        to_email: str,
        template_id: str,
        dynamic_data: Dict[str, Any],
        to_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send email using SendGrid dynamic template.
        
        Args:
            to_email: Recipient email
            template_id: SendGrid template ID
            dynamic_data: Template variable data
            to_name: Recipient name
            
        Returns:
            dict: Send result
        """
        try:
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email, to_name)
            )
            
            message.template_id = template_id
            message.dynamic_template_data = dynamic_data
            
            response = self.client.send(message)
            message_id = response.headers.get('X-Message-Id')
            
            logger.info(f"Template email sent to {to_email} | Template: {template_id}")
            
            return {
                'success': True,
                'message_id': message_id,
                'status_code': response.status_code,
                'error': None
            }
            
        except Exception as e:
            logger.error(f"Template email error: {str(e)}")
            return {
                'success': False,
                'message_id': None,
                'status_code': 500,
                'error': str(e)
            }
    
    @staticmethod
    def _personalize(template: str, data: Dict[str, Any]) -> str:
        """
        Replace {{variable}} placeholders with actual values.
        
        Args:
            template: Template string with {{variable}} syntax
            data: Dictionary of variable values
            
        Returns:
            str: Personalized string
        """
        result = template
        for key, value in data.items():
            placeholder = f"{{{{{key}}}}}"
            result = result.replace(placeholder, str(value))
        return result
    
    @staticmethod
    def process_webhook(event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process SendGrid event webhook.
        
        Events: delivered, open, click, bounce, spam_report, unsubscribe
        
        Args:
            event_data: SendGrid event POST data
            
        Returns:
            dict: Parsed event data
        """
        return {
            'event': event_data.get('event'),
            'email': event_data.get('email'),
            'timestamp': event_data.get('timestamp'),
            'message_id': event_data.get('sg_message_id'),
            'campaign_id': event_data.get('campaign_id'),
            'url': event_data.get('url'),  # For click events
            'reason': event_data.get('reason'),  # For bounce/spam
            'status': event_data.get('status')
        }
    
    def create_html_email(
        self,
        title: str,
        heading: str,
        body_text: str,
        cta_text: Optional[str] = None,
        cta_url: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> str:
        """
        Generate simple HTML email template.
        
        Args:
            title: Email title (for <title> tag)
            heading: Main heading
            body_text: Main body content (supports HTML)
            cta_text: Call-to-action button text
            cta_url: CTA button link
            footer_text: Footer content
            
        Returns:
            str: HTML email string
        """
        cta_html = ""
        if cta_text and cta_url:
            cta_html = f'''
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 30px 0;">
                <tr>
                    <td style="background-color: #007bff; border-radius: 4px;">
                        <a href="{cta_url}" style="
                            display: inline-block;
                            padding: 12px 30px;
                            color: #ffffff;
                            text-decoration: none;
                            font-weight: bold;
                            font-size: 16px;
                        ">{cta_text}</a>
                    </td>
                </tr>
            </table>
            '''
        
        footer_html = ""
        if footer_text:
            footer_html = f'''
            <div style="
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #dddddd;
                font-size: 12px;
                color: #666666;
            ">
                {footer_text}
            </div>
            '''
        
        return f'''
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{title}</title>
        </head>
        <body style="
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
        ">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="600" style="
                            background-color: #ffffff;
                            border-radius: 8px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        ">
                            <tr>
                                <td style="padding: 40px;">
                                    <h1 style="
                                        margin: 0 0 20px 0;
                                        font-size: 24px;
                                        color: #333333;
                                    ">{heading}</h1>
                                    <div style="
                                        font-size: 16px;
                                        line-height: 1.6;
                                        color: #555555;
                                    ">
                                        {body_text}
                                    </div>
                                    {cta_html}
                                    {footer_html}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        '''


def get_sendgrid_service() -> Optional[SendGridService]:
    """
    Factory function to create SendGridService from environment.
    
    Returns:
        SendGridService or None if not configured
    """
    from config import settings
    
    api_key = settings.SENDGRID_API_KEY
    from_email = settings.SENDGRID_FROM_EMAIL
    
    if not all([api_key, from_email]):
        logger.warning(
            "SendGrid not configured - Email sending disabled. "
            "Set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL"
        )
        return None
    
    return SendGridService(api_key, from_email)
