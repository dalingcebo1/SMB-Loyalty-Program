"""
Appointment Reminder Service

Sends SMS/email reminders to customers before their appointments.
Can be called manually or scheduled via Celery (future integration).
"""
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import Appointment, User, Stylist, BeautyService
from app.vertical_models.beauty_reviews import AppointmentReminder


class ReminderService:
    """Service for managing appointment reminders."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_reminder(
        self,
        appointment_id: int,
        reminder_type: str,  # 'sms', 'email', 'push'
        hours_before: int = 24,
    ) -> AppointmentReminder:
        """Create a reminder for an appointment."""
        appointment = self.db.query(Appointment).filter(
            Appointment.id == appointment_id
        ).first()
        
        if not appointment:
            raise ValueError(f"Appointment {appointment_id} not found")
        
        # Calculate send time
        appointment_datetime = datetime.combine(
            appointment.appointment_date,
            appointment.start_time
        )
        send_at = appointment_datetime - timedelta(hours=hours_before)
        
        reminder = AppointmentReminder(
            appointment_id=appointment_id,
            tenant_id=appointment.tenant_id,
            reminder_type=reminder_type,
            send_at=send_at,
            hours_before=hours_before,
            status="pending",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        
        self.db.add(reminder)
        self.db.commit()
        self.db.refresh(reminder)
        
        return reminder
    
    def get_pending_reminders(
        self,
        tenant_id: Optional[str] = None,
        limit_time: Optional[datetime] = None,
    ) -> List[AppointmentReminder]:
        """Get reminders that need to be sent."""
        if limit_time is None:
            limit_time = datetime.now()
        
        query = self.db.query(AppointmentReminder).filter(
            AppointmentReminder.status == "pending",
            AppointmentReminder.send_at <= limit_time,
        )
        
        if tenant_id:
            query = query.filter(AppointmentReminder.tenant_id == tenant_id)
        
        return query.all()
    
    def send_sms_reminder(self, reminder: AppointmentReminder) -> bool:
        """Send SMS reminder via Twilio/Africa's Talking."""
        try:
            # Get appointment details
            appointment = self.db.query(Appointment).filter(
                Appointment.id == reminder.appointment_id
            ).first()
            
            if not appointment:
                self._mark_failed(reminder, "Appointment not found")
                return False
            
            # Get customer details
            customer = self.db.query(User).filter(
                User.id == appointment.customer_id
            ).first()
            
            if not customer or not customer.phone:
                self._mark_failed(reminder, "Customer phone not found")
                return False
            
            # Get service and stylist details
            service = self.db.query(BeautyService).filter(
                BeautyService.id == appointment.service_id
            ).first()
            stylist = self.db.query(Stylist).filter(
                Stylist.id == appointment.stylist_id
            ).first()
            
            # Format message
            message = self._format_sms_message(
                customer_name=customer.name,
                service_name=service.name if service else "appointment",
                stylist_name=stylist.name if stylist else "our stylist",
                appointment_date=appointment.appointment_date,
                appointment_time=appointment.start_time,
            )
            
            # TODO: Integrate with Twilio/Africa's Talking
            # For now, just log the message
            print(f"SMS to {customer.phone}: {message}")
            
            # Mark as sent
            reminder.status = "sent"
            reminder.sent_at = datetime.now()
            reminder.updated_at = datetime.now()
            self.db.commit()
            
            return True
            
        except Exception as e:
            self._mark_failed(reminder, str(e))
            return False
    
    def send_email_reminder(self, reminder: AppointmentReminder) -> bool:
        """Send email reminder via SendGrid."""
        try:
            # Get appointment details
            appointment = self.db.query(Appointment).filter(
                Appointment.id == reminder.appointment_id
            ).first()
            
            if not appointment:
                self._mark_failed(reminder, "Appointment not found")
                return False
            
            # Get customer details
            customer = self.db.query(User).filter(
                User.id == appointment.customer_id
            ).first()
            
            if not customer or not customer.email:
                self._mark_failed(reminder, "Customer email not found")
                return False
            
            # Get service and stylist details
            service = self.db.query(BeautyService).filter(
                BeautyService.id == appointment.service_id
            ).first()
            stylist = self.db.query(Stylist).filter(
                Stylist.id == appointment.stylist_id
            ).first()
            
            # Format email
            subject = "Upcoming Appointment Reminder"
            body = self._format_email_body(
                customer_name=customer.name,
                service_name=service.name if service else "appointment",
                stylist_name=stylist.name if stylist else "our stylist",
                appointment_date=appointment.appointment_date,
                appointment_time=appointment.start_time,
            )
            
            # Send via SendGrid (gracefully falls back to logging if not configured)
            from app.external.sendgrid_service import get_sendgrid_service
            sg = get_sendgrid_service()
            if sg:
                html_content = sg.create_html_email(
                    title=subject,
                    heading=subject,
                    body_text=body.replace("\n", "<br/>"),
                    footer_text="This is an automated reminder.",
                )
                result = sg.send_email(
                    to_email=customer.email,
                    subject=subject,
                    html_content=html_content,
                    to_name=customer.name,
                )
                if not result["success"]:
                    self._mark_failed(reminder, result.get("error", "SendGrid send failed"))
                    return False
            else:
                # Fallback: log the email when SendGrid is not configured
                print(f"Email to {customer.email}: Subject: {subject}\n{body}")
            
            # Mark as sent
            reminder.status = "sent"
            reminder.sent_at = datetime.now()
            reminder.updated_at = datetime.now()
            self.db.commit()
            
            return True
            
        except Exception as e:
            self._mark_failed(reminder, str(e))
            return False
    
    def process_pending_reminders(self, tenant_id: Optional[str] = None) -> dict:
        """Process all pending reminders."""
        reminders = self.get_pending_reminders(tenant_id=tenant_id)
        
        stats = {
            "total": len(reminders),
            "sent": 0,
            "failed": 0,
        }
        
        for reminder in reminders:
            success = False
            
            if reminder.reminder_type == "sms":
                success = self.send_sms_reminder(reminder)
            elif reminder.reminder_type == "email":
                success = self.send_email_reminder(reminder)
            # TODO: Add push notification support
            
            if success:
                stats["sent"] += 1
            else:
                stats["failed"] += 1
        
        return stats
    
    def _mark_failed(self, reminder: AppointmentReminder, error_message: str):
        """Mark a reminder as failed."""
        reminder.status = "failed"
        reminder.error_message = error_message
        reminder.updated_at = datetime.now()
        self.db.commit()
    
    def _format_sms_message(
        self,
        customer_name: str,
        service_name: str,
        stylist_name: str,
        appointment_date,
        appointment_time,
    ) -> str:
        """Format SMS reminder message."""
        return (
            f"Hi {customer_name}! Reminder: You have a {service_name} appointment "
            f"with {stylist_name} tomorrow at {appointment_time.strftime('%H:%M')}. "
            f"See you then!"
        )
    
    def _format_email_body(
        self,
        customer_name: str,
        service_name: str,
        stylist_name: str,
        appointment_date,
        appointment_time,
    ) -> str:
        """Format email reminder body."""
        return f"""
        Hi {customer_name},
        
        This is a friendly reminder about your upcoming appointment:
        
        Service: {service_name}
        Stylist: {stylist_name}
        Date: {appointment_date.strftime('%A, %B %d, %Y')}
        Time: {appointment_time.strftime('%I:%M %p')}
        
        We look forward to seeing you!
        
        If you need to reschedule or cancel, please contact us as soon as possible.
        
        Best regards,
        Your Beauty Salon Team
        """


def create_appointment_reminders(
    db: Session,
    appointment_id: int,
    reminder_types: List[str] = None,
) -> List[AppointmentReminder]:
    """
    Create reminders for a new appointment.
    
    Args:
        db: Database session
        appointment_id: ID of the appointment
        reminder_types: List of reminder types ('sms', 'email', 'push')
                       Defaults to ['sms', 'email']
    
    Returns:
        List of created reminders
    """
    if reminder_types is None:
        reminder_types = ["sms", "email"]
    
    service = ReminderService(db)
    reminders = []
    
    for reminder_type in reminder_types:
        try:
            reminder = service.create_reminder(
                appointment_id=appointment_id,
                reminder_type=reminder_type,
                hours_before=24,  # Send 24 hours before
            )
            reminders.append(reminder)
        except Exception as e:
            print(f"Failed to create {reminder_type} reminder: {e}")
    
    return reminders


# Celery task placeholder (to be implemented when Celery is integrated)
# @celery_app.task
# def process_appointment_reminders_task():
#     """Celery task to process pending appointment reminders."""
#     from app.core.database import SessionLocal
#     
#     db = SessionLocal()
#     try:
#         service = ReminderService(db)
#         stats = service.process_pending_reminders()
#         print(f"Processed reminders: {stats}")
#         return stats
#     finally:
#         db.close()
