"""
Transactional Notification Service

Sends event-driven email notifications for payments, bookings, orders,
loyalty milestones, and reward redemptions.  Uses the existing SendGrid
integration and runs as a FastAPI BackgroundTask so that the main request
is not blocked.

All monetary values arrive as integer *cents* and are formatted to ZAR
(R X.XX) for display.
"""

import logging
from datetime import date, time
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.external.sendgrid_service import get_sendgrid_service, SendGridService
from app.models import Tenant, TenantBranding

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _cents_to_zar(cents: int) -> str:
    """Format integer cents as ZAR currency string (e.g. R 123.45)."""
    return f"R {cents / 100:,.2f}"


def _format_date(d: Optional[date]) -> str:
    if d is None:
        return ""
    return d.strftime("%A, %d %B %Y")


def _format_time(t: Optional[time]) -> str:
    if t is None:
        return ""
    return t.strftime("%I:%M %p")


def _get_branding(db: Session, tenant_id: str) -> Dict[str, Any]:
    """Return tenant branding dict (business name, colors, logo)."""
    branding: Optional[TenantBranding] = (
        db.query(TenantBranding).filter_by(tenant_id=tenant_id).first()
    )
    tenant: Optional[Tenant] = db.query(Tenant).filter_by(id=tenant_id).first()

    business_name = "SMB Loyalty"
    primary_color = "#007bff"
    logo_url: Optional[str] = None

    if branding:
        business_name = branding.public_name or branding.short_name or (tenant.name if tenant else business_name)
        primary_color = branding.primary_color or primary_color
        logo_url = branding.logo_light_url
    elif tenant:
        business_name = tenant.name or business_name

    return {
        "business_name": business_name,
        "primary_color": primary_color,
        "logo_url": logo_url,
    }


def _build_html(
    heading: str,
    body_html: str,
    branding: Dict[str, Any],
    footer_extra: str = "",
) -> str:
    """Build a simple, mobile-responsive HTML email with tenant branding."""
    logo_block = ""
    if branding.get("logo_url"):
        logo_block = (
            f'<img src="{branding["logo_url"]}" alt="{branding["business_name"]}" '
            f'style="max-height:48px;margin-bottom:16px;" /><br/>'
        )

    color = branding.get("primary_color", "#007bff")
    biz = branding.get("business_name", "SMB Loyalty")

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>{heading}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        <tr><td style="background:{color};padding:24px 40px;border-radius:8px 8px 0 0;text-align:center;">
          {logo_block}
          <h1 style="margin:0;color:#fff;font-size:22px;">{heading}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;font-size:15px;line-height:1.6;color:#333;">
          {body_html}
        </td></tr>
        <tr><td style="padding:0 40px 32px;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;text-align:center;">
          {biz}{' — ' + footer_extra if footer_extra else ''}<br/>
          This is an automated message. Please do not reply directly.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send(
    sendgrid: SendGridService,
    to_email: str,
    subject: str,
    html: str,
    to_name: Optional[str] = None,
) -> None:
    """Send an email and log the outcome.  Never raises."""
    try:
        result = sendgrid.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html,
            to_name=to_name,
        )
        if result["success"]:
            logger.info("Transactional email sent to %s — %s", to_email, subject)
        else:
            logger.warning(
                "Transactional email failed for %s — %s: %s",
                to_email, subject, result.get("error"),
            )
    except Exception:
        logger.exception("Unexpected error sending transactional email to %s", to_email)


# ---------------------------------------------------------------------------
# Public trigger functions — each designed to be called via BackgroundTasks
# ---------------------------------------------------------------------------

def send_payment_receipt(
    db: Session,
    *,
    to_email: str,
    to_name: str,
    tenant_id: str,
    order_id: int,
    payment_reference: str,
    amount_cents: int,
    items_summary: str = "",
) -> None:
    """Send a payment receipt email after a successful Yoco payment."""
    sg = get_sendgrid_service()
    if not sg:
        logger.debug("SendGrid not configured — skipping payment receipt for order %s", order_id)
        return

    branding = _get_branding(db, tenant_id)
    body = (
        f"<p>Hi {to_name},</p>"
        f"<p>Your payment has been received successfully. Here are your details:</p>"
        f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Order #</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{order_id}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Payment Ref</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{payment_reference}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Total</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{_cents_to_zar(amount_cents)}</td></tr>"
        f"</table>"
    )
    if items_summary:
        body += f"<p><strong>Items:</strong><br/>{items_summary}</p>"
    body += "<p>Thank you for your purchase!</p>"

    html = _build_html("Payment Receipt", body, branding)
    _send(sg, to_email, f"Payment Receipt — Order #{order_id}", html, to_name)


def send_beauty_appointment_confirmation(
    db: Session,
    *,
    to_email: str,
    to_name: str,
    tenant_id: str,
    stylist_name: str,
    service_name: str,
    appointment_date: date,
    start_time: time,
    location: str = "",
) -> None:
    """Send a confirmation email when a beauty appointment is booked."""
    sg = get_sendgrid_service()
    if not sg:
        logger.debug("SendGrid not configured — skipping appointment confirmation")
        return

    branding = _get_branding(db, tenant_id)
    body = (
        f"<p>Hi {to_name},</p>"
        f"<p>Your appointment has been confirmed! Here are the details:</p>"
        f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Service</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{service_name}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Stylist</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{stylist_name}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Date</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{_format_date(appointment_date)}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Time</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{_format_time(start_time)}</td></tr>"
    )
    if location:
        body += f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Location</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{location}</td></tr>"
    body += "</table><p>We look forward to seeing you!</p>"

    html = _build_html("Appointment Confirmed", body, branding)
    _send(sg, to_email, "Your Appointment is Confirmed", html, to_name)


def send_padel_booking_confirmation(
    db: Session,
    *,
    to_email: str,
    to_name: str,
    tenant_id: str,
    court_number: str,
    booking_date: date,
    start_time: time,
    duration_minutes: int,
    total_price_cents: int,
) -> None:
    """Send a confirmation email when a padel court is booked."""
    sg = get_sendgrid_service()
    if not sg:
        logger.debug("SendGrid not configured — skipping padel booking confirmation")
        return

    branding = _get_branding(db, tenant_id)
    body = (
        f"<p>Hi {to_name},</p>"
        f"<p>Your court booking is confirmed!</p>"
        f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Court</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{court_number}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Date</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{_format_date(booking_date)}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Time</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{_format_time(start_time)}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Duration</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{duration_minutes} minutes</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Total</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{_cents_to_zar(total_price_cents)}</td></tr>"
        f"</table>"
        f"<p>Enjoy your game!</p>"
    )

    html = _build_html("Court Booking Confirmed", body, branding)
    _send(sg, to_email, "Padel Court Booking Confirmation", html, to_name)


def send_flower_order_confirmation(
    db: Session,
    *,
    to_email: str,
    to_name: str,
    tenant_id: str,
    order_number: str,
    delivery_date: Optional[date],
    delivery_time_slot: str = "",
    recipient_name: str = "",
    items_summary: str = "",
    total_cents: int,
) -> None:
    """Send a confirmation email when a flower order is placed."""
    sg = get_sendgrid_service()
    if not sg:
        logger.debug("SendGrid not configured — skipping flower order confirmation")
        return

    branding = _get_branding(db, tenant_id)
    body = (
        f"<p>Hi {to_name},</p>"
        f"<p>Thank you for your order! Here is your order summary:</p>"
        f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Order #</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{order_number}</td></tr>"
    )
    if delivery_date:
        body += f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Delivery Date</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{_format_date(delivery_date)}</td></tr>"
    if delivery_time_slot:
        body += f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Time Slot</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{delivery_time_slot}</td></tr>"
    if recipient_name:
        body += f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Recipient</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{recipient_name}</td></tr>"
    body += (
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Total</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{_cents_to_zar(total_cents)}</td></tr>"
        f"</table>"
    )
    if items_summary:
        body += f"<p><strong>Items:</strong><br/>{items_summary}</p>"
    body += "<p>We'll keep you updated on your order status.</p>"

    html = _build_html("Order Confirmation", body, branding)
    _send(sg, to_email, f"Order Confirmed — {order_number}", html, to_name)


def send_flower_order_status_update(
    db: Session,
    *,
    to_email: str,
    to_name: str,
    tenant_id: str,
    order_number: str,
    new_status: str,
) -> None:
    """Send a status update email when a flower order moves to out_for_delivery or delivered."""
    sg = get_sendgrid_service()
    if not sg:
        logger.debug("SendGrid not configured — skipping order status update")
        return

    branding = _get_branding(db, tenant_id)

    status_messages = {
        "out_for_delivery": "Your order is on its way! Our driver is heading to the delivery address now.",
        "delivered": "Your order has been delivered. We hope you enjoy it!",
    }
    message = status_messages.get(new_status, f"Your order status has been updated to: {new_status}.")

    body = (
        f"<p>Hi {to_name},</p>"
        f"<p>{message}</p>"
        f"<p><strong>Order #:</strong> {order_number}</p>"
    )

    html = _build_html("Order Status Update", body, branding)
    _send(sg, to_email, f"Order Update — {order_number}", html, to_name)


def send_loyalty_milestone(
    db: Session,
    *,
    to_email: str,
    to_name: str,
    tenant_id: str,
    visit_count: int,
    reward_title: str = "",
) -> None:
    """Send a congratulatory email when a customer reaches a visit milestone."""
    sg = get_sendgrid_service()
    if not sg:
        logger.debug("SendGrid not configured — skipping loyalty milestone email")
        return

    branding = _get_branding(db, tenant_id)
    body = (
        f"<p>Hi {to_name},</p>"
        f"<p>Congratulations! You've reached <strong>{visit_count} visits</strong>! 🎉</p>"
    )
    if reward_title:
        body += f"<p>You've earned a reward: <strong>{reward_title}</strong>. Claim it on your next visit!</p>"
    else:
        body += "<p>Thank you for your continued loyalty.</p>"

    html = _build_html("Loyalty Milestone Reached!", body, branding)
    _send(sg, to_email, f"Congratulations — {visit_count} visits!", html, to_name)


def send_reward_redemption_receipt(
    db: Session,
    *,
    to_email: str,
    to_name: str,
    tenant_id: str,
    reward_title: str,
    milestone: int,
) -> None:
    """Send a receipt email when a reward is redeemed."""
    sg = get_sendgrid_service()
    if not sg:
        logger.debug("SendGrid not configured — skipping reward redemption receipt")
        return

    branding = _get_branding(db, tenant_id)
    body = (
        f"<p>Hi {to_name},</p>"
        f"<p>Your reward has been successfully redeemed!</p>"
        f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Reward</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{reward_title}</td></tr>"
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee;'><strong>Milestone</strong></td><td style='padding:8px;border-bottom:1px solid #eee;'>{milestone} visits</td></tr>"
        f"</table>"
        f"<p>Thank you for being a loyal customer!</p>"
    )

    html = _build_html("Reward Redeemed", body, branding)
    _send(sg, to_email, "Your Reward Has Been Redeemed", html, to_name)
