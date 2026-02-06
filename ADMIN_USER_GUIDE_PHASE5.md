# Admin User Guide - Marketing & Financial Tools

**Last Updated**: February 6, 2026  
**Version**: 2.0  
**Target Audience**: Business owners, managers, and administrators

---

## Table of Contents

1. [Introduction](#introduction)
2. [Marketing Campaigns](#marketing-campaigns)
3. [Financial Management](#financial-management)
4. [Provider Configuration](#provider-configuration)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Introduction

Welcome to the SMB Loyalty Platform! This guide covers the latest features added in Phase 5:

- **📧 Marketing Campaigns**: Create and send email/SMS campaigns with AI-powered content
- **💰 Financial Tools**: Generate invoices, track expenses, and view profit & loss reports
- **🔗 Provider Integration**: Automated SMS (Twilio) and email (SendGrid) sending

These tools help you engage customers and manage your business finances more effectively.

---

## Marketing Campaigns

### Overview

Send targeted marketing messages to your customers via email or SMS. Features include:

- 🤖 **AI Content Generation**: Let AI write your marketing copy
- 🎯 **Customer Segmentation**: Target specific customer groups
- 📊 **Delivery Tracking**: Monitor opens, clicks, and deliveries
- ⏰ **Scheduling**: Send immediately or schedule for later
- 📝 **Personalization**: Customize messages per customer

### Creating Your First Campaign

#### Step 1: Choose Your Audience

First, decide who should receive your campaign:

**Audience Segments:**

| Segment | Description | Use Case |
|---------|-------------|----------|
| **All Customers** | Everyone in your database | General announcements, holidays |
| **High Value** | Top 20% spenders | VIP offers, exclusive deals |
| **Active** | Recent purchasers (last 30 days) | New product launches, upsells |
| **At Risk** | Haven't purchased in 60+ days | Win-back campaigns, special offers |
| **Dormant** | Inactive for 90+ days | Re-engagement campaigns |
| **Recent** | New customers (last 7 days) | Welcome series, onboarding |

**Example Filters:**

- High-value customers who spent > R1,000
- Active customers who purchased in last 14 days
- At-risk customers who haven't bought in 90 days

#### Step 2: Generate Content with AI

Let AI write your marketing message:

**1. Navigate to Campaigns → New Campaign → Generate with AI**

**2. Fill in the prompts:**

- **Content Type**: Email or SMS
- **Campaign Goal**: "Promote 20% off winter sale ending this weekend"
- **Tone**: Choose from:
  - **Friendly**: Warm, conversational (recommended for most campaigns)
  - **Professional**: Business-like, formal
  - **Urgent**: Time-sensitive, action-oriented
  - **Casual**: Relaxed, informal
  - **Formal**: Very professional, corporate
- **Customer Name**: (Optional) "Sarah" for personalization examples
- **Offer Details**: "Use code WINTER20 for 20% off all items"

**3. Review Generated Content:**

AI will generate:
- Email subject line (e.g., "⏰ Last Chance: 20% Off Winter Sale Ends Sunday!")
- Email/SMS body with proper formatting
- Call-to-action and personalization

**4. Edit if needed** - Feel free to tweak the AI's suggestions

#### Step 3: Preview Your Audience

Before sending, see who will receive your campaign:

1. Click **Preview Segment**
2. Review:
   - **Customer Count**: Total recipients (e.g., "145 customers")
   - **Sample Customers**: Preview of 10 customers with their details
   - **Estimated Reach**: Expected delivery success rate

**Tips:**
- ✅ Check that customer count matches your expectations
- ✅ Verify contact details (email/phone) are present
- ⚠️ If count is too low, consider broadening your segment
- ⚠️ If count is too high, consider narrowing your filters

#### Step 4: Create the Campaign

Fill in the final details:

**Email Campaign:**
```
Name: VIP Winter Sale 2026
Type: Email
Audience: High Value Customers (spent > R1,000)
Subject: ⏰ Last Chance: 20% Off Winter Sale Ends Sunday!
Content: [Your AI-generated or custom HTML content]
Schedule: Send immediately OR schedule for specific date/time
```

**SMS Campaign:**
```
Name: Flash Sale Alert
Type: SMS
Audience: Active Customers
Message: ⚡ Flash Sale! 30% off for 3 hours only. Shop now: [link]
Schedule: Send immediately
```

**Important Notes:**
- 📧 Emails can be up to 10,000 characters with HTML formatting
- 📱 SMS should be under 160 characters for best results (longer messages split into multiple texts)
- 💰 SMS messages cost credits - check your Twilio balance

#### Step 5: Send or Schedule

**Option A: Send Immediately**
1. Click **Create Campaign**
2. Review final preview
3. Click **Send Now**
4. Campaign status changes to "Sending..."
5. Track progress in real-time

**Option B: Schedule for Later**
1. Set **Schedule Date & Time** (e.g., "February 15, 2026 at 9:00 AM")
2. Click **Create Campaign**
3. Campaign status shows "Scheduled"
4. Automatic sending at scheduled time
5. You can edit or cancel before send time

### Tracking Campaign Performance

Once sent, monitor your campaign's success:

**Key Metrics:**

| Metric | Description | Good Benchmark |
|--------|-------------|----------------|
| **Delivery Rate** | % successfully delivered | > 95% |
| **Open Rate** | % who opened email | 15-25% (email) |
| **Click Rate** | % who clicked links | 2-5% (email) |
| **Bounce Rate** | % failed deliveries | < 5% |

**View Campaign Details:**
1. Navigate to **Campaigns** → Select your campaign
2. See real-time stats:
   - Recipients: 145 customers
   - Sent: 145 (100%)
   - Delivered: 142 (97.9%)
   - Opened: 34 (23.9%)
   - Clicked: 8 (5.6%)

**Per-Recipient Breakdown:**
- See individual delivery status for each customer
- Identify bounced emails/invalid phone numbers
- Track who opened and clicked (email only)

**Export Results:**
- Download campaign report as CSV
- Include customer names, statuses, timestamps
- Use for follow-up actions

### Campaign Examples

#### 🎉 Example 1: VIP Appreciation Email

**Goal:** Thank top customers and offer exclusive discount

**Setup:**
- Audience: High Value (spent > R2,000)
- Type: Email
- AI Prompt: "Thank VIP customers and offer 25% exclusive discount"
- Schedule: Send Tuesday at 10 AM

**Generated Content:**
```
Subject: You're Our VIP - Enjoy 25% Off! 🎁

Hi [Customer Name],

As one of our most valued customers, we wanted to say a huge thank you!

Your support means the world to us, and to show our appreciation, 
we're giving you exclusive access to 25% off your entire next purchase.

Use code VIP25 at checkout before Sunday.

Thank you for choosing [Your Business Name]!

[Shop Now Button]
```

**Results:**
- Sent to: 67 VIP customers
- Opened: 42 (62.7%) ← High because it's personal
- Clicked: 18 (26.9%) ← Great click rate
- Revenue: R15,420 in sales attributed to campaign

#### 📱 Example 2: Flash Sale SMS

**Goal:** Drive immediate traffic during slow hour

**Setup:**
- Audience: Active Customers (purchased last 30 days)
- Type: SMS
- Custom Content (no AI needed - simple message)
- Schedule: Send immediately

**Message:**
```
⚡ Flash Sale! 30% off everything for the next 3 hours only. 
Shop now: https://shop.example.com/flash
```

**Results:**
- Sent to: 234 customers
- Delivered: 229 (97.9%)
- Website visits within 1 hour: 87 customers
- Purchases: 23 orders (R8,940 revenue)

#### 💤 Example 3: Win-Back Campaign

**Goal:** Re-engage customers who haven't purchased in 90 days

**Setup:**
- Audience: At Risk (no purchase in 90+ days)
- Type: Email
- AI Prompt: "We miss you! Come back with 15% off"
- Tone: Friendly

**Generated Content:**
```
Subject: We Miss You! Here's 15% Off to Welcome You Back 💙

Hi [Customer Name],

It's been a while since we've seen you, and we wanted to reach out!

We've added tons of new products you might love, and to celebrate your return, 
here's 15% off your next order with code COMEBACK15.

[Browse New Arrivals] [Shop Sale Items]

Hope to see you soon!
```

**Results:**
- Sent to: 312 dormant customers
- Opened: 78 (25.0%)
- Clicked: 14 (4.5%)
- Reactivated: 9 customers made purchases (2.9% reactivation rate)

### Advanced: Customer Segmentation Options

Create precise audience targeting:

**1. Spending-Based Segments**
```json
{
  "segment_type": "high_value",
  "segment_config": {
    "min_total_spent": 2000,
    "currency": "ZAR"
  }
}
```
- Targets customers who spent R2,000+

**2. Recency-Based Segments**
```json
{
  "segment_type": "at_risk",
  "segment_config": {
    "days_since_purchase": 90
  }
}
```
- Targets customers with no purchase in 90+ days

**3. Recent Registrations**
```json
{
  "segment_type": "recent",
  "segment_config": {
    "days_lookback": 7
  }
}
```
- Targets customers who registered in last 7 days

**4. Purchase Frequency**
```json
{
  "segment_type": "active",
  "segment_config": {
    "min_purchases": 3,
    "days_lookback": 90
  }
}
```
- Targets customers with 3+ purchases in last 90 days

---

## Financial Management

### Overview

Manage your business finances with professional tools:

- 📄 **Invoicing**: Create and send professional invoices
- 💳 **Payment Tracking**: Record payments and track outstanding amounts
- 📊 **Expense Management**: Track business expenses by category
- 📈 **Profit & Loss Reports**: View financial health and trends

### Creating Invoices

#### Step 1: Navigate to Invoices

Go to **Financial** → **Invoices** → **New Invoice**

#### Step 2: Fill in Customer Details

**Customer Information:**
- Customer Name: "Acme Corporation" (required)
- Email: billing@acme.com (optional, for sending invoice)
- Phone: +27821234567 (optional)
- Address: 123 Business St, Cape Town, 8001 (optional)

**Tip:** Link to existing customer record for automatic contact info

#### Step 3: Add LineItems

Add each product or service sold:

**Example Line Items:**

| Description | Quantity | Unit Price | Total |
|-------------|----------|------------|-------|
| Consulting Services - Feb 2026 | 40 hours | R1,250.00/hr | R50,000.00 |
| Software License (Annual) | 1 | R5,999.00 | R5,999.00 |
| Setup Fee | 1 | R1,500.00 | R1,500.00 |

**Subtotal:** R57,499.00

**Tips:**
- ✅ Use clear, descriptive item names
- ✅ Link to products in your catalog when possible
- ✅ Break down complex services into separate line items

#### Step 4: Add Tax and Discounts

**Tax (VAT):**
- Default: 15% (South African VAT)
- Editable for other rates or tax-exempt items
- Tax Amount: R57,499.00 × 15% = R8,624.85

**Discount:**
- Optional discount amount: R500.00
- Applied after subtotal, before tax
- Common use: Early payment discount, bulk order discount

**Total Calculation:**
```
Subtotal:  R57,499.00
Tax (15%): R 8,624.85
Discount:  -R  500.00
────────────────────
Total Due: R65,623.85
```

#### Step 5: Set Payment Terms

**Due Date:**
- Default: 30 days from invoice date
- Editable: 7, 14, 30, 60, or 90 days
- Shown on invoice: "Due by March 7, 2026"

**Payment Terms Example:**
```
Payment is due within 30 days of invoice date.

Accepted payment methods:
- Bank transfer (preferred)
- Credit card
- Cash

Late payments subject to 2% monthly interest.

Account Details:
  Bank: Standard Bank
  Account: 123456789
  Branch: 051001
```

**Invoice Notes:**
```
Thank you for your business!

For questions about this invoice, contact us at:
billing@yourbusiness.com or +27821234567
```

#### Step 6: Save and Send

**Option A: Save as Draft**
- Review later before sending
- Make edits if needed
- Status: "Draft"

**Option B: Send to Customer**
- Email invoice as PDF attachment
- Professional HTML formatting
- Automatic status change to "Sent"
- Customer receives:
  - PDF invoice
  - Payment instructions
  - Due date reminder

**Option C: Mark as Sent** (if sending manually)
- Status changes to "Sent"
- Start tracking as outstanding

### Tracking Payments

#### Recording Received Payments

When customer pays:

1. **Find Invoice**: Navigate to invoices, select the one paid
2. **Click "Record Payment"**
3. **Fill Details:**
   - Amount: R65,623.85 (or partial payment)
   - Payment Method: Bank Transfer / Credit Card / Cash / Other
   - Payment Date: February 15, 2026
   - Reference: Customer's transaction reference
   - Notes: Any additional details

4. **Confirm**: Invoice status updates automatically
   - Partial payment: Status  = "Partially Paid" (shows balance)
   - Full payment: Status = "Paid"

#### Invoice Statuses

| Status | Meaning | Action Needed |
|--------|---------|---------------|
| **Draft** | Not sent yet | Review and send |
| **Sent** | Awaiting payment | Monitor due date |
| **Partially Paid** | Partial payment received | Follow up for balance |
| **Paid** | Fully paid | Archive, no action |
| **Overdue** | Past due date, unpaid | Send reminder |
| **Cancelled** | Cancelled invoice | No payment expected |

#### Managing Overdue Invoices

Invoices automatically marked "Overdue" after due date passes:

**Follow-Up Actions:**
1. **Day 1-7 Overdue**: Friendly reminder email
   - "Hi [Customer], friendly reminder your invoice #INV-001 was due on [date]"
   
2. **Day 8-30 Overdue**: Formal reminder
   - "Invoice #INV-001 is now [X] days overdue. Please remit payment at your earliest convenience."
   
3. **30+ Days Overdue**: Final notice
   - Consider late fees (if in terms)
   - Escalate to collections if necessary

**Automated Reminders** (if configured):
- Auto-send email 3 days before due date
- Auto-send reminder 7 days after due date
- Auto-send final notice 30 days after due date

### Expense Tracking

Track all business expenses for better financial visibility:

#### Adding an Expense

1. **Navigate to Financial → Expenses → New Expense**

2. **Fill in Details:**
   - **Amount**: R599.00
   - **Category**: Select from predefined categories
   - **Description**: "Office supplies - printer paper and ink"
   - **Date**: February 5, 2026
   - **Vendor**: "Office Mart"
   - **Payment Method**: Credit Card / Cash / Bank Transfer
   - **Receipt**: Upload photo/PDF of receipt (optional)

3. **Categories Available:**

| Category | Examples | Tax Deductible? |
|----------|----------|-----------------|
| **Office Supplies** | Paper, pens, ink | ✅ Yes |
| **Marketing** | Ads, campaigns, signage | ✅ Yes |
| **Utilities** | Electricity, water, internet | ✅ Yes |
| **Rent** | Office or retail space | ✅ Yes |
| **Salaries** | Employee wages | ✅ Yes |
| **Professional Services** | Accountant, lawyer | ✅ Yes |
| **Travel** | Mileage, fuel, accommodation | ✅ Yes |
| **Equipment** | Computers, furniture | ✅ Yes (depreciation) |
| **Inventory** | Product stock purchases | ✅ Yes (COGS) |
| **Miscellaneous** | Other business expenses | Maybe |

#### Approving Expenses

If your role requires approval:

1. **View Pending Expenses**: Financial → Expenses → Pending tab
2. **Review Details**: Amount, category, receipt, description
3. **Action:**
   - **Approve**: Expense becomes tax-deductible and appears in P&L
   - **Reject**: Expense excluded from reports
   - **Request Info**: Ask for more details or proper receipt

**Approval Workflow:**
- Staff submits expense
- Manager reviews and approves
- Finance team processes reimbursement
- Expense appears in financial reports

### Profit & Loss Reports

View your business financial health:

#### Generating a P&L Report

1. **Navigate to Financial → Reports → Profit & Loss**

2. **Select Date Range:**
   - This Month
   - Last Month
   - This Quarter
   - This Year
   - Custom Range (e.g., Jan 1 - Feb 6, 2026)

3. **View Report Structure:**

**Example P&L Report (January 2026):**

```
═══════════════════════════════════════
    PROFIT & LOSS STATEMENT
    January 1 - January 31, 2026
═══════════════════════════════════════

REVENUE
  Product Sales          R 125,450.00
  Service Revenue        R  68,900.00
  ────────────────────────────────────
  Total Revenue          R 194,350.00

COST OF GOODS SOLD (COGS)
  Inventory Purchased    R  45,200.00
  ────────────────────────────────────
  Gross Profit           R 149,150.00
  Gross Margin           76.7%

OPERATING EXPENSES
  Salaries               R  42,000.00
  Rent                   R  12,500.00
  Utilities              R   2,850.00
  Marketing              R   8,450.00
  Office Supplies        R   1,240.00
  Professional Services  R   4,500.00
  Travel                 R   1,980.00
  Miscellaneous          R     845.00
  ────────────────────────────────────
  Total Expenses         R  74,365.00

NET PROFIT               R  74,785.00
Net Margin               38.5%

═══════════════════════════════════════
```

#### Understanding Your P&L

**Key Metrics Explained:**

- **Total Revenue**: All money received from sales
  - **Target**: Growing month-over-month
  
- **Gross Profit**: Revenue minus direct product costs (COGS)
  - **Good**: > 50%
  - **Excellent**: > 70%
  
- **Operating Expenses**: Running costs of business
  - **Monitor**: Should stay relatively consistent
  - **Warning**: If growing faster than revenue
  
- **Net Profit**: What's left after all expenses
  - **Healthy**: > 10% of revenue
  - **Strong**: > 20% of revenue
  - **Excellent**: > 30% of revenue

**Net Margin Calculation:**
```
Net Margin = (Net Profit ÷ Total Revenue) × 100
           = (R74,785 ÷ R194,350) × 100
           = 38.5%
```

#### Comparing Periods

View trends over time:

**Month-over-Month Comparison:**
```
                  January      February     Change
Revenue           R194,350     R208,920     +7.5% ↑
Expenses          R119,565     R124,210     +3.9% ↑
Net Profit        R 74,785     R 84,710    +13.3% ↑
Net Margin          38.5%        40.5%     +2.0pp ↑
```

**Year-over-Year Comparison:**
```
                  Feb 2025     Feb 2026     Growth
Revenue           R156,200     R208,920     +33.7% ↑
Net Profit        R 48,500     R 84,710     +74.7% ↑
```

**Trends to Watch:**
- ✅ Revenue growing faster than expenses = healthy
- ⚠️ Expenses growing faster than revenue = review costs
- ✅ Net margin improving = efficiency gains
- ⚠️ Net margin declining = investigate cause

#### Export Financial Reports

Download reports for:
- Accounting software import
- Tax preparation
- Investor presentations
- Loan applications

**Formats:**
- PDF (printable)
- Excel/CSV (editable)
- JSON (API integration)

---

## Provider Configuration

### Setting Up SMS (Twilio)

To send SMS campaigns:

**1. Create Twilio Account** (if not already set up)
- Visit: https://www.twilio.com/try-twilio
- Get free trial credits ($15 USD)

**2. Get Credentials:**
- Account SID: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Auth Token: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Phone Number: `+15551234567`

**3. Share with Developer/IT Team** to configure in platform

**4. Verify Configuration:**
- Navigate to **Settings → Providers → SMS Status**
- Should show: ✅ "Twilio configured and operational"

**5. Test Sending:**
- Send test SMS to your phone
- Verify delivery

### Setting Up Email (SendGrid)

To send email campaigns and invoices:

**1. Create SendGrid Account**
- Visit: https://signup.sendgrid.com/
- Free tier: 100 emails/day

**2. Verify Sender Email:**
- Add your business email (e.g., noreply@yourbusiness.com)
- Complete verification process

**3. Get API Key:**
- Create API key with "Mail Send" permission
- Copy key: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**4. Share with Developer/IT Team** to configure

**5. Verify Configuration:**
- Navigate to **Settings → Providers → Email Status**
- Should show: ✅ "SendGrid configured and operational"

**6. Test Sending:**
- Send test email to yourself
- Check inbox and spam folder

### Checking Provider Health

**Real-Time Status Dashboard:**

Navigate to **Settings → Providers** to see:

```
╔═══════════════════════════════════════════╗
║         PROVIDER STATUS                   ║
╠═══════════════════════════════════════════╣
║ SMS (Twilio)                              ║
║   Status: ✅ Configured                   ║
║   Phone: +15551234567                     ║
║   Balance: $12.45 USD                     ║
║   Last Used: 2 minutes ago                ║
╠═══════════════════════════════════════════╣
║ Email (SendGrid)                          ║
║   Status: ✅ Configured                   ║
║   From: noreply@yourbusiness.com          ║
║   Daily Quota: 78 / 100 sent              ║
║   Last Used: 15 minutes ago               ║
╚═══════════════════════════════════════════╝
```

**Status Indicators:**
- ✅ **Configured**: Provider is set up and working
- ⚠️ **Not Configured**: Credentials missing or invalid
- ❌ **Error**: API connection failed (check credentials)

---

## Best Practices

### Marketing Campaigns

**✅ Do:**
- **Test First**: Send test campaigns to yourself before going live
- **Segment Smartly**: Smaller, targeted campaigns perform better than mass blasts
- **Personalize**: Use customer names and relevant offers
- **Time It Right**: Send emails Tuesday-Thursday, 10 AM - 2 PM for best open rates
- **Monitor Metrics**: Track performance and adjust strategy
- **Respect Unsubscribes**: Remove opt-outs immediately
- **Mobile-Friendly**: Most emails opened on mobile - keep it simple

**❌ Don't:**
- **Over-Send**: Max 1-2 campaigns per week to avoid unsubscribes
- **All Caps**: LOOKS LIKE SPAM and reduces opens
- **Too Many Links**: Keep to 2-3 clear calls-to-action
- **Ignore Results**: Learn from campaign data
- **Buy Lists**: Only email customers who opted in
- **Forget Legal**: Include business address and unsubscribe link (automatic)

### Financial Management

**✅ Do:**
- **Invoice Promptly**: Send invoices immediately after service/delivery
- **Clear Terms**: State payment terms clearly on every invoice
- **Follow Up**: Send reminders for overdue invoices
- **Track Everything**: Record all expenses with receipts
- **Categorize Correctly**: Proper categories = accurate tax prep
- **Regular Reviews**: Check P&L reports monthly
- **Backup Receipts**: Upload photos of physical receipts

**❌ Don't:**
- **Delay Invoicing**: Waiting reduces payment likelihood
- **Forget Tax**: Always include applicable VAT
- **Mix Personal/Business**: Keep business expenses separate
- **Lose Receipts**: Digital backups prevent loss
- **Ignore Patterns**: Review expense trends regularly
- **Wait Until Tax Time**: Keep books updated year-round

### Communication Tips

**Email Subject Lines:**
- ✅ "🎉 Exclusive 25% Off for VIP Customers"
- ✅ "Sarah, your favorite items are on sale!"
- ✅ "Last Chance: Sale Ends Tonight at Midnight"
- ❌ "Newsletter" (too vague)
- ❌ "BUY NOW!!!" (too aggressive)

**SMS Messages:**
- ✅ Keep under 160 characters
- ✅ Include your business name
- ✅ Clear call-to-action
- ✅ Short link (use URL shortener)
- ❌ Multiple texts per day
- ❌ Sending during sleeping hours (11 PM - 8 AM)

---

## Troubleshooting

### Campaign Issues

**Problem: "No customers in segment"**
- **Solution**: Broaden your segment filter criteria
- Check: Do customers have required contact info (email/phone)?
- Try: Use "All Customers" segment to verify database has contacts

**Problem: "Low email open rate" (< 10%)**
- **Solution**: 
  - Improve subject line (use emoji, personalization, urgency)
  - Check sender name (should be your business, not "noreply")
  - Verify emails not going to spam (ask customers to check)
  - Send at better times (Tuesday-Thursday, late morning)

**Problem: "High bounce rate" (> 10%)**
- **Solution**:
  - Check customer email addresses for typos
  - Remove invalid addresses from future campaigns
  - Use double opt-in for new signups

**Problem: "SMS not delivered"**
- **Solution**:
  - Verify phone numbers include country code (+27 for SA)
  - Check Twilio balance (low balance = failures)
  - Confirm phone numbers are mobile (not landline)
  - Check for opt-outs/blocklists

### Financial Issues

**Problem: "Invoice total incorrect"**
- **Solution**:
  - Review line item quantities and prices (stored in cents!)
  - Check tax rate (should be 15% for SA VAT)
  - Verify discount applied correctly
  - Formula: (Subtotal + Tax - Discount) = Total

**Problem: "Can't send invoice by email"**
- **Solution**:
  - Check customer has valid email address
  - Verify SendGrid configured (Settings → Providers)
  - Check SendGrid daily quota not exceeded
  - Try manual send (download PDF and email separately)

**Problem: "Expense not appearing in P&L"**
- **Solution**:
  - Check expense status (must be "Approved")
  - Verify date range includes expense date
  - Confirm expense has valid category assigned
  - Refresh/reload the report

**Problem: "P&L numbers seem wrong"**
- **Solution**:
  - Verify date range selected is correct
  - Check all invoices marked "Paid" are actually paid
  - Ensure expenses properly categorized
  - Review for duplicate entries
  - Contact support if still incorrect

### Provider Connection Issues

**Problem: "Provider Status shows ❌ Error"**
- **Solution**:
  - Contact your developer/IT team
  - Check credentials haven't expired
  - Verify internet connection
  - Review provider dashboard for account status

**Problem: "Emails going to spam"**
- **Solution**:
  - Complete SendGrid domain authentication
  - Avoid spam trigger words (FREE, LIMITED TIME, ACT NOW)
  - Ask customers to whitelist your email
  - Include physical business address in footer

---

## Getting Help

### Support Channels

- **In-App Help**: Click "?" icon in top right of any page
- **Email Support**: support@yourbusiness.com
- **Phone**: [Your support phone number]
- **Documentation**: https://docs.yourbusiness.com

### What to Include When Reporting Issues

1. **Issue Description**: "Emails not sending to customers"
2. **Steps Taken**: "Created campaign, selected 50 customers, clicked send"
3. **Error Messages**: Screenshot or copy exact error text
4. **Campaign/Invoice ID**: "Campaign #42" or "Invoice #INV-123"
5. **Date/Time**: "February 6, 2026 at 2:30 PM"
6. **Your Email**: So we can follow up

### Response Times

- **Critical** (system down, major features broken): 1 hour
- **High** (feature not working, blocking work): 4 hours
- **Medium** (inconvenience, workaround available): 24 hours
- **Low** (questions, feature requests): 48 hours

---

## Appendix: Quick Reference

### Campaign Keyboard Shortcuts

- `Ctrl+N`: New campaign
- `Ctrl+P`: Preview campaign
- `Ctrl+S`: Save draft
- `Ctrl+Enter`: Send campaign

### Invoice Keyboard Shortcuts

- `Ctrl+N`: New invoice
- `Ctrl+S`: Save draft
- `Ctrl+Enter`: Send to customer
- `Ctrl+P`: Print invoice

### Common Formulas

**Email Open Rate:**
```
(Opened Emails ÷ Delivered Emails) × 100
= (34 ÷ 142) × 100
= 23.9%
```

**Invoice Total:**
```
Subtotal = Sum of (Quantity × Unit Price)
Tax = Subtotal × (Tax Rate ÷ 100)
Total = Subtotal + Tax - Discount
```

**Net Profit Margin:**
```
Net Margin = (Net Profit ÷ Revenue) × 100
= (R74,785 ÷ R194,350) × 100
= 38.5%
```

---

**Need more help?** Contact your system administrator or support team.

**Stay updated!** Check the changelog for new features and improvements: [CHANGES_2025-02-06.md](./CHANGES_2025-02-06.md)
