"""Tests for transactional notification service."""
import pytest
from datetime import date, time
from unittest.mock import patch, MagicMock

from app.services.transactional_notifications import (
    _cents_to_zar,
    _format_date,
    _format_time,
    _get_branding,
    _build_html,
    send_payment_receipt,
    send_beauty_appointment_confirmation,
    send_padel_booking_confirmation,
    send_flower_order_confirmation,
    send_flower_order_status_update,
    send_loyalty_milestone,
    send_reward_redemption_receipt,
)


# ---------------------------------------------------------------------------
# Helper formatting tests
# ---------------------------------------------------------------------------

class TestCentsToZar:
    def test_basic(self):
        assert _cents_to_zar(12345) == "R 123.45"

    def test_zero(self):
        assert _cents_to_zar(0) == "R 0.00"

    def test_large(self):
        assert _cents_to_zar(1_000_000) == "R 10,000.00"

    def test_single_cent(self):
        assert _cents_to_zar(1) == "R 0.01"


class TestFormatDate:
    def test_normal(self):
        result = _format_date(date(2026, 3, 21))
        assert "2026" in result
        assert "March" in result

    def test_none(self):
        assert _format_date(None) == ""


class TestFormatTime:
    def test_normal(self):
        result = _format_time(time(14, 30))
        assert "02:30 PM" in result

    def test_none(self):
        assert _format_time(None) == ""


# ---------------------------------------------------------------------------
# Branding lookup
# ---------------------------------------------------------------------------

class TestGetBranding:
    def test_returns_defaults_when_no_branding(self, db_session):
        branding = _get_branding(db_session, "nonexistent-tenant")
        assert branding["business_name"] == "SMB Loyalty"
        assert branding["primary_color"] == "#007bff"
        assert branding["logo_url"] is None

    def test_returns_tenant_name_when_no_branding_record(self, db_session):
        from config import settings
        branding = _get_branding(db_session, settings.default_tenant)
        # Tenant exists but branding record may not; should use tenant.name
        assert isinstance(branding["business_name"], str)
        assert len(branding["business_name"]) > 0


# ---------------------------------------------------------------------------
# HTML builder
# ---------------------------------------------------------------------------

class TestBuildHtml:
    def test_contains_heading(self):
        html = _build_html("Test Subject", "<p>Body</p>", {"business_name": "Test", "primary_color": "#000", "logo_url": None})
        assert "Test Subject" in html
        assert "<p>Body</p>" in html
        assert "Test" in html

    def test_includes_logo_when_present(self):
        html = _build_html("H", "<p>B</p>", {"business_name": "T", "primary_color": "#000", "logo_url": "https://example.com/logo.png"})
        assert "https://example.com/logo.png" in html


# ---------------------------------------------------------------------------
# Send functions — verify they call SendGrid correctly or skip gracefully
# ---------------------------------------------------------------------------

class TestSendPaymentReceipt:
    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_skips_when_not_configured(self, mock_get_sg, db_session):
        mock_get_sg.return_value = None
        # Should not raise
        send_payment_receipt(
            db_session,
            to_email="test@example.com",
            to_name="Test",
            tenant_id="default",
            order_id=1,
            payment_reference="ref123",
            amount_cents=5000,
        )

    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_sends_email_when_configured(self, mock_get_sg, db_session):
        mock_sg = MagicMock()
        mock_sg.send_email.return_value = {"success": True, "message_id": "123"}
        mock_get_sg.return_value = mock_sg

        send_payment_receipt(
            db_session,
            to_email="test@example.com",
            to_name="Test",
            tenant_id="default",
            order_id=42,
            payment_reference="ref123",
            amount_cents=5000,
            items_summary="Wash x1",
        )

        mock_sg.send_email.assert_called_once()
        call_kwargs = mock_sg.send_email.call_args
        assert call_kwargs.kwargs["to_email"] == "test@example.com"
        assert "R 50.00" in call_kwargs.kwargs["html_content"]
        assert "42" in call_kwargs.kwargs["subject"]


class TestSendBeautyAppointmentConfirmation:
    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_sends_confirmation(self, mock_get_sg, db_session):
        mock_sg = MagicMock()
        mock_sg.send_email.return_value = {"success": True, "message_id": "abc"}
        mock_get_sg.return_value = mock_sg

        send_beauty_appointment_confirmation(
            db_session,
            to_email="client@example.com",
            to_name="Alice",
            tenant_id="default",
            stylist_name="Jane",
            service_name="Haircut",
            appointment_date=date(2026, 4, 1),
            start_time=time(10, 0),
        )

        mock_sg.send_email.assert_called_once()
        html = mock_sg.send_email.call_args.kwargs["html_content"]
        assert "Haircut" in html
        assert "Jane" in html


class TestSendPadelBookingConfirmation:
    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_sends_confirmation(self, mock_get_sg, db_session):
        mock_sg = MagicMock()
        mock_sg.send_email.return_value = {"success": True, "message_id": "xyz"}
        mock_get_sg.return_value = mock_sg

        send_padel_booking_confirmation(
            db_session,
            to_email="player@example.com",
            to_name="Bob",
            tenant_id="default",
            court_number="3",
            booking_date=date(2026, 5, 15),
            start_time=time(16, 0),
            duration_minutes=60,
            total_price_cents=20000,
        )

        mock_sg.send_email.assert_called_once()
        html = mock_sg.send_email.call_args.kwargs["html_content"]
        assert "Court" in html
        assert "R 200.00" in html


class TestSendFlowerOrderConfirmation:
    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_sends_confirmation(self, mock_get_sg, db_session):
        mock_sg = MagicMock()
        mock_sg.send_email.return_value = {"success": True, "message_id": "flo"}
        mock_get_sg.return_value = mock_sg

        send_flower_order_confirmation(
            db_session,
            to_email="buyer@example.com",
            to_name="Carol",
            tenant_id="default",
            order_number="FLW-001",
            delivery_date=date(2026, 6, 1),
            delivery_time_slot="9AM-12PM",
            recipient_name="Dave",
            items_summary="Red Roses x2",
            total_cents=35000,
        )

        mock_sg.send_email.assert_called_once()
        html = mock_sg.send_email.call_args.kwargs["html_content"]
        assert "FLW-001" in html
        assert "R 350.00" in html
        assert "Dave" in html


class TestSendFlowerOrderStatusUpdate:
    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_out_for_delivery(self, mock_get_sg, db_session):
        mock_sg = MagicMock()
        mock_sg.send_email.return_value = {"success": True, "message_id": "s1"}
        mock_get_sg.return_value = mock_sg

        send_flower_order_status_update(
            db_session,
            to_email="buyer@example.com",
            to_name="Carol",
            tenant_id="default",
            order_number="FLW-001",
            new_status="out_for_delivery",
        )

        mock_sg.send_email.assert_called_once()
        html = mock_sg.send_email.call_args.kwargs["html_content"]
        assert "on its way" in html

    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_delivered(self, mock_get_sg, db_session):
        mock_sg = MagicMock()
        mock_sg.send_email.return_value = {"success": True, "message_id": "s2"}
        mock_get_sg.return_value = mock_sg

        send_flower_order_status_update(
            db_session,
            to_email="buyer@example.com",
            to_name="Carol",
            tenant_id="default",
            order_number="FLW-001",
            new_status="delivered",
        )

        html = mock_sg.send_email.call_args.kwargs["html_content"]
        assert "delivered" in html.lower()


class TestSendLoyaltyMilestone:
    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_sends_milestone(self, mock_get_sg, db_session):
        mock_sg = MagicMock()
        mock_sg.send_email.return_value = {"success": True, "message_id": "lm"}
        mock_get_sg.return_value = mock_sg

        send_loyalty_milestone(
            db_session,
            to_email="loyal@example.com",
            to_name="Eve",
            tenant_id="default",
            visit_count=10,
            reward_title="Free Wash",
        )

        mock_sg.send_email.assert_called_once()
        html = mock_sg.send_email.call_args.kwargs["html_content"]
        assert "10 visits" in html
        assert "Free Wash" in html


class TestSendRewardRedemptionReceipt:
    @patch("app.services.transactional_notifications.get_sendgrid_service")
    def test_sends_receipt(self, mock_get_sg, db_session):
        mock_sg = MagicMock()
        mock_sg.send_email.return_value = {"success": True, "message_id": "rr"}
        mock_get_sg.return_value = mock_sg

        send_reward_redemption_receipt(
            db_session,
            to_email="loyal@example.com",
            to_name="Eve",
            tenant_id="default",
            reward_title="Free Wash",
            milestone=10,
        )

        mock_sg.send_email.assert_called_once()
        html = mock_sg.send_email.call_args.kwargs["html_content"]
        assert "Free Wash" in html
        assert "10" in html
