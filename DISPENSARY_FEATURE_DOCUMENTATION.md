# Dispensary Vertical Feature - Complete Implementation

## Overview

The Dispensary vertical is a comprehensive cannabis retail management system with full compliance tracking, age verification, and integrated loyalty rewards. This feature supports both customer-facing product browsing and admin management.

## Features

### 🌿 Customer Features
- **Product Catalog** - Browse cannabis products by category, strain type, and potency
- **Age Verification** - Mandatory age/medical card verification before purchase
- **Shopping Cart** - Add products and complete purchases
- **Purchase Limits** - Automatic tracking of daily/monthly purchase limits
- **Product Information** - Detailed strain info, THC/CBD percentages, terpenes, effects

### 🛠️ Admin Features
- **Product Management** - Full CRUD for cannabis products with compliance data
- **Category Management** - Organize products into categories (Flower, Edibles, etc.)
- **Verification Management** - Review and approve customer age/medical card verifications
- **Sales Reports** - Track sales history with CSV export for compliance
- **Inventory Tracking** - Monitor stock levels and batch numbers

## Database Schema

### Tables
- `dispensary_product_categories` - Product categories with medical card requirements
- `dispensary_products` - Cannabis products with strain, potency, batch tracking
- `dispensary_customer_verifications` - Age and medical card verification records
- `dispensary_purchase_limit_tracking` - Daily/monthly purchase limit tracking
- `dispensary_sales` - Sales transactions with compliance data
- `dispensary_sale_items` - Line items for each sale

## API Endpoints

### Categories
- `POST /api/dispensary/categories` - Create category
- `GET /api/dispensary/categories` - List categories (supports `?active_only=true`)
- `GET /api/dispensary/categories/{id}` - Get category  
- `PUT /api/dispensary/categories/{id}` - Update category
- `DELETE /api/dispensary/categories/{id}` - Soft delete category

### Products
- `POST /api/dispensary/products` - Create product
- `GET /api/dispensary/products` - List products (filters: `category_id`, `strain_type`, `featured_only`, `search`)
- `GET /api/dispensary/products/{id}` - Get product
- `PUT /api/dispensary/products/{id}` - Update product
- `DELETE /api/dispensary/products/{id}` - Soft delete product

### Verifications
- `POST /api/dispensary/verifications` - Create verification
- `GET /api/dispensary/verifications` - List all verifications (admin) (filters: `status`, `has_medical_card`)
- `GET /api/dispensary/verifications/{customer_id}` - Get customer verification
- `PUT /api/dispensary/verifications/{customer_id}` - Update verification

### Sales
- `POST /api/dispensary/sales` - Create sale transaction
- `GET /api/dispensary/sales` - List sales (filters: `start_date`, `end_date`, `payment_method`)
- `GET /api/dispensary/sales/{id}` - Get sale details
- `GET /api/dispensary/compliance/sales-report` - Compliance sales report

### Purchase Limits
- `GET /api/dispensary/purchase-limits/{customer_id}` - Get customer purchase limits

## Frontend Routes

### Customer Routes
- `/dispensary` - Product catalog and shopping

### Admin Routes
- `/admin/dispensary/products` - Product management
- `/admin/dispensary/categories` - Category management
- `/admin/dispensary/verifications` - Customer verification management
- `/admin/dispensary/sales` - Sales reports and history

## Setup & Testing

### 1. Seed Sample Data

```bash
cd Backend
python -m scripts.seed_dispensary_data <tenant_id>
```

This creates:
- 8 product categories (Flower, Edibles, Concentrates, Vapes, etc.)
- 12+ sample products with realistic strain data
- Stock quantities and batch numbers

### 2. Run Backend Tests

```bash
cd Backend
pytest tests/test_dispensary.py -v
```

Tests cover:
- Category CRUD operations
- Product CRUD with filters
- Customer verification workflow
- Sales transaction creation
- Purchase limit tracking

### 3. Manual Testing

1. **Create a dispensary tenant**:
   ```bash
   # Use the tenant creation API or dev portal
   POST /api/dev/tenants
   {
     "vertical_type": "dispensary",
     "name": "Green Leaf Dispensary"
   }
   ```

2. **Seed data** (see step 1 above)

3. **Test customer flow**:
   - Visit `/dispensary` as a customer
   - Browse products by category
   - Note: Purchase requires age verification

4. **Test admin flow**:
   - Visit `/admin/dispensary/products` as admin/staff
   - Create/edit products with strain info
   - Manage categories at `/admin/dispensary/categories`
   - Review verifications at `/admin/dispensary/verifications`
   - View sales at `/admin/dispensary/sales`

## Compliance Features

### Age Verification
- **Required**: All customers must complete age verification before purchase
- **Methods**: ID scan, manual verification by staff
- **Statuses**: pending, verified, rejected, expired
- **Data Tracked**: Date of birth, ID document type/number/expiry

### Medical Card Tracking
- Optional for general products
- Required for medical-only categories
- Tracks: card number, expiry date, medical condition

### Purchase Limits
- Tracks daily and monthly purchase totals
- Configurable limits per jurisdiction
- Prevents over-purchasing

### Batch Tracking
- Every product has batch number, harvest date, package date
- Enables product recalls and compliance reporting
- Tracks expiry dates for perishable products

### Sales Records
- Complete audit trail of all transactions
- Exportable as CSV for regulatory reporting
- Includes customer verification status at time of sale

## Data Model Examples

### Product
```json
{
  "id": 1,
  "category_id": 1,
  "name": "Blue Dream",
  "strain": "Blue Dream",
  "strain_type": "hybrid",
  "thc_percentage": 22.5,
  "cbd_percentage": 0.8,
  "terpenes": "Myrcene, Pinene, Caryophyllene",
  "effects": "Relaxed, Happy, Euphoric",
  "medical_uses": "Stress, Pain, Depression",
  "price_cents": 15000,
  "unit_size": "3.5g",
  "stock_quantity": 50,
  "batch_number": "BD220125",
  "potency_level": "high",
  "featured": true
}
```

### Verification
```json
{
  "id": 1,
  "customer_id": 123,
  "age_verified": true,
  "date_of_birth": "1990-05-15",
  "age_verification_method": "ID scan",
  "has_medical_card": false,
  "id_document_type": "Driver's License",
  "verification_status": "verified",
  "verified_by_staff_id": 456
}
```

### Sale
```json
{
  "id": 1,
  "customer_id": 123,
  "sale_date": "2026-02-06T10:30:00Z",
  "payment_method": "card",
  "total_amount_cents": 30000,
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "unit_price_cents": 15000,
      "product_name": "Blue Dream",
      "batch_number": "BD220125"
    }
  ]
}
```

## Styling

The dispensary pages use the `admin-modern.css` design system:
- Clean card-based layouts
- Consistent form styling
- Responsive tables
- Professional color scheme
- Icon integration with react-icons

## Future Enhancements

### Potential Additions
- [ ] Lab test results (COA) upload and display
- [ ] Customer prescription tracking
- [ ] Delivery scheduling integration
- [ ] Loyalty points for dispensary purchases
- [ ] Product recommendations based on effects/medical uses
- [ ] Inventory alerts for low stock
- [ ] Automated compliance reporting
- [ ] Photo ID verification integration
- [ ] QR code batch tracking
- [ ] Product reviews and ratings

## Integration Points

### Existing System Integration
- **Loyalty Program**: Sales automatically award loyalty points
- **User Management**: Uses existing user/customer system
- **Tenant System**: Full multi-tenant support
- **Payment Processing**: Integrates with existing payment routes
- **Analytics**: Sales data feeds into analytics dashboard

## Security & Compliance

### Access Control
- Customer catalog: Authenticated users only
- Admin pages: Staff/admin roles required
- Verification management: Staff+ only
- Sales reports: Admin access recommended

### Data Protection
- Sensitive verification data encrypted at rest
- GDPR-compliant customer data handling
- Audit logs for all verification changes
- Secure document storage for ID uploads (future)

### Regulatory Compliance
- Age verification before any purchase
- Complete sales audit trail
- Batch/lot tracking for recalls
- Daily/monthly purchase limits
- Medical card verification for medical products

## Technical Notes

### Frontend Stack
- React 18 with TypeScript
- TanStack React Query for data fetching
- React Icons for UI elements
- Custom CSS modules (admin-modern.css)

### Backend Stack
- FastAPI with Pydantic validation
- SQLAlchemy ORM
- Multi-tenant architecture
- Comprehensive test coverage

### Performance
- Lazy loading for route components
- Optimistic updates with React Query
- Indexed database queries
- Efficient pagination support

## Documentation Files

Related documentation:
- `/Backend/app/routes/dispensary.py` - API implementation
- `/Backend/app/verticals/dispensary.py` - Vertical module definition
- `/Backend/tests/test_dispensary.py` - Test suite
- `/Backend/scripts/seed_dispensary_data.py` - Seed data script
- `/Frontend/src/features/dispensary/pages/` - Frontend pages

## Support

For issues or questions:
1. Check test suite for usage examples
2. Review API endpoint documentation in code
3. Test with seed data first
4. Verify tenant vertical_type is "dispensary"
