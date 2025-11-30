# Dynamic Tenant Domain Mappings

## Overview

The SMB Loyalty platform now supports dynamic domain-to-tenant mapping through the `tenant_domains` table. This eliminates the need for code changes when onboarding new clients or setting up multiple environments.

## How It Works

### Tenant Resolution Priority

When a request arrives, the backend resolves the tenant in this order:

1. **`X-Tenant-ID` Header** - Explicit tenant identifier (highest priority)
2. **`tenant_domains` Table** - Dynamic domain mappings (new!)
3. **`primary_domain` Field** - Legacy static domain mapping (backward compatible)
4. **Default Tenant Fallback** - In production or when `ALLOW_DEFAULT_TENANT_FALLBACK_NON_PROD=true`

### Database Schema

```sql
CREATE TABLE tenant_domains (
    id           SERIAL PRIMARY KEY,
    tenant_id    VARCHAR NOT NULL REFERENCES tenants(id),
    domain       VARCHAR NOT NULL UNIQUE,
    is_primary   BOOLEAN DEFAULT FALSE,
    environment  VARCHAR,  -- 'production', 'dev', 'staging', etc.
    created_at   TIMESTAMP
);
```

**Indexes:**
- `ix_tenant_domains_lookup (domain, tenant_id)` - Fast tenant resolution
- `ix_tenant_domains_tenant_id (tenant_id)` - List domains for a tenant
- `ix_tenant_domains_domain (domain)` - Unique domain constraint

## Usage Examples

### 1. Adding a Domain Mapping (Admin API)

```bash
POST /api/admin/tenant-domains
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "tenant_id": "acme-carwash",
  "domain": "loyalty.acmecarwash.com",
  "is_primary": true,
  "environment": "production"
}
```

### 2. Listing Domain Mappings

```bash
GET /api/admin/tenant-domains?tenant_id=acme-carwash
Authorization: Bearer <admin_token>
```

Response:
```json
[
  {
    "id": 1,
    "tenant_id": "acme-carwash",
    "domain": "loyalty.acmecarwash.com",
    "is_primary": true,
    "environment": "production",
    "created_at": "2025-11-30T10:00:00Z"
  },
  {
    "id": 2,
    "tenant_id": "acme-carwash",
    "domain": "dev-acme.azurestaticapps.net",
    "is_primary": false,
    "environment": "dev",
    "created_at": "2025-11-30T10:05:00Z"
  }
]
```

### 3. Looking Up a Domain

```bash
GET /api/admin/tenant-domains/lookup/loyalty.acmecarwash.com
Authorization: Bearer <admin_token>
```

### 4. Updating a Domain

```bash
PATCH /api/admin/tenant-domains/1
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "is_primary": false,
  "environment": "staging"
}
```

### 5. Deleting a Domain

```bash
DELETE /api/admin/tenant-domains/1
Authorization: Bearer <admin_token>
```

## Seed Script

To quickly add domain mappings for the default tenant:

```bash
cd Backend
python scripts/seed_tenant_domains.py
```

The script adds:
- `orange-pond-06eea490f.3.azurestaticapps.net` (dev environment)
- `localhost:5173` (local development)
- `127.0.0.1:5173` (local development)

## Migration

Apply the migration to create the table:

```bash
cd Backend
python -m alembic upgrade head
```

## Environment Configuration

### For Development/Testing

Set this environment variable to enable default tenant fallback in non-production:

```bash
ALLOW_DEFAULT_TENANT_FALLBACK_NON_PROD=true
DEFAULT_TENANT=default
```

### For Production

The default tenant fallback is automatically enabled when:

```bash
ENVIRONMENT=production
DEFAULT_TENANT=<your-default-tenant-id>
```

## Benefits

1. **No Code Changes** - Add new clients by inserting a row, no deployment needed
2. **Multi-Environment Support** - One tenant can have dev, staging, and prod domains
3. **Easy Onboarding** - New clients can be configured via API or database
4. **Backward Compatible** - Existing `primary_domain` field still works
5. **Flexible** - Support custom domains, Azure SWA domains, local dev, etc.

## Client Onboarding Workflow

### Option 1: Via Admin API

1. Create tenant via existing admin endpoints
2. Add domain mapping:
   ```bash
   POST /api/admin/tenant-domains
   {
     "tenant_id": "new-client",
     "domain": "loyalty.newclient.com",
     "is_primary": true,
     "environment": "production"
   }
   ```
3. Point client's DNS to the backend
4. Done! 🎉

### Option 2: Via Database

```sql
INSERT INTO tenant_domains (tenant_id, domain, is_primary, environment, created_at)
VALUES ('new-client', 'loyalty.newclient.com', true, 'production', NOW());
```

### Option 3: Via Seed Script

Edit `Backend/scripts/seed_tenant_domains.py` and add your domain to the `domains_to_add` list.

## Security Considerations

1. **Admin-Only Access** - All tenant domain management endpoints require `manage_tenants` capability
2. **Unique Domains** - Database constraint ensures one domain maps to only one tenant
3. **Audit Logging** - Consider adding audit logs for domain changes (future enhancement)
4. **Rate Limiting** - Tenant resolution is cached and rate-limited to prevent abuse

## Testing

Test tenant resolution:

```bash
# With explicit header (always works)
curl -H "X-Tenant-ID: default" https://api.example.com/api/public/tenant-meta

# With Host header (uses tenant_domains lookup)
curl -H "Host: orange-pond-06eea490f.3.azurestaticapps.net" \
  https://api.example.com/api/public/tenant-meta

# From actual domain (natural production use)
curl https://loyalty.acmecarwash.com/api/public/tenant-meta
```

## Troubleshooting

### 404 - Tenant Not Found

1. Check if domain exists in `tenant_domains`:
   ```sql
   SELECT * FROM tenant_domains WHERE domain = 'your-domain.com';
   ```

2. Check if tenant exists:
   ```sql
   SELECT * FROM tenants WHERE id = 'your-tenant-id';
   ```

3. Verify Host header is being sent correctly

### Domain Already Exists (409 Conflict)

The domain is already mapped to another tenant. Remove the existing mapping first:

```bash
DELETE /api/admin/tenant-domains/{id}
```

## Future Enhancements

- [ ] Wildcard domain support (e.g., `*.carwash.com`)
- [ ] Domain ownership verification (DNS TXT record)
- [ ] Automatic SSL certificate provisioning
- [ ] Domain expiration/renewal tracking
- [ ] Audit log for domain changes
- [ ] Bulk import via CSV
- [ ] Frontend UI for domain management
