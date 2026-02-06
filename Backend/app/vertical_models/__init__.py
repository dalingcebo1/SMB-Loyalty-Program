"""Vertical-specific models package - beauty salon extensions only."""

# Only export the new beauty-specific models that aren't in main models.py
from app.vertical_models.beauty_packages import BeautyPackage, PackageBooking, package_services
from app.vertical_models.beauty_reviews import ServiceReview, AppointmentReminder
from app.vertical_models.campaigns import Campaign, CampaignRecipient, CustomerSegment, CampaignType, CampaignStatus, SegmentType
from app.vertical_models.financial import Invoice, InvoiceLineItem, InvoiceStatus, Expense, ExpenseCategory, PaymentMethod, FinancialYear

__all__ = [
    "BeautyPackage",
    "PackageBooking",
    "package_services",
    "ServiceReview",
    "AppointmentReminder",
    "Campaign",
    "CampaignRecipient",
    "CustomerSegment",
    "CampaignType",
    "CampaignStatus",
    "SegmentType",
    "Invoice",
    "InvoiceLineItem",
    "InvoiceStatus",
    "Expense",
    "ExpenseCategory",
    "PaymentMethod",
    "FinancialYear",
]
