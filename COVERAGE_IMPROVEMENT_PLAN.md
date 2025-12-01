# Coverage Improvement Plan

**Current Coverage:** 44.38%  
**Target Coverage:** 70%  
**Gap to Close:** 625 statements (~26% increase)

## Priority 1: Cache Infrastructure (186 statements)

### Backend/app/core/cache_warmer.py (99 statements, 0% coverage)
**Priority:** HIGH - Critical for production performance

Test cases needed:
- [ ] `test_cache_warmer_initialization` - Verify warmer starts correctly
- [ ] `test_warm_tenant_metadata` - Test metadata warming for single tenant
- [ ] `test_warm_all_tenants` - Test batch warming of all tenants
- [ ] `test_cache_warmer_with_failures` - Test error handling and retry logic
- [ ] `test_cache_warmer_metrics` - Verify metrics are recorded
- [ ] `test_cache_warmer_background_task` - Test async/background warming

Estimated: 6 test cases, ~50 lines of test code

### Backend/app/core/tenant_cache.py (87 statements, 0% coverage)
**Priority:** HIGH - Core caching functionality

Test cases needed:
- [ ] `test_tenant_cache_get_miss` - Test cache miss scenario
- [ ] `test_tenant_cache_get_hit` - Test cache hit scenario
- [ ] `test_tenant_cache_set` - Test setting cache values
- [ ] `test_tenant_cache_invalidate` - Test cache invalidation
- [ ] `test_tenant_cache_ttl_expiration` - Test TTL behavior
- [ ] `test_tenant_cache_multi_tenant_isolation` - Ensure tenant isolation

Estimated: 6 test cases, ~45 lines of test code

## Priority 2: Background Workers (208 statements)

### Backend/app/workers/celery_app.py (6 statements, 0% coverage)
**Priority:** MEDIUM - Worker initialization

Test cases needed:
- [ ] `test_celery_app_initialization` - Verify Celery app starts
- [ ] `test_celery_app_configuration` - Test config is loaded correctly

Estimated: 2 test cases, ~20 lines of test code

### Backend/app/workers/tasks.py (202 statements, 0% coverage)
**Priority:** MEDIUM - Background task execution

Test cases needed:
- [ ] `test_analytics_refresh_task` - Test analytics refresh job
- [ ] `test_cache_warming_task` - Test cache warming job
- [ ] `test_email_notification_task` - Test email sending
- [ ] `test_task_error_handling` - Test task failure scenarios
- [ ] `test_task_retry_logic` - Test automatic retries
- [ ] `test_task_scheduling` - Test periodic task scheduling

Estimated: 6 test cases, ~70 lines of test code

## Priority 3: Carwash Vertical (350 statements)

### Backend/app/verticals/carwash/models.py (81 statements, 0% coverage)
**Priority:** HIGH - Data models

Test cases needed:
- [ ] `test_wash_package_model` - Test WashPackage model
- [ ] `test_wash_addon_model` - Test WashAddon model
- [ ] `test_wash_session_model` - Test WashSession model
- [ ] `test_model_relationships` - Test model relationships

Estimated: 4 test cases, ~40 lines of test code

### Backend/app/verticals/carwash/services.py (89 statements, 0% coverage)
**Priority:** HIGH - Business logic

Test cases needed:
- [ ] `test_create_wash_package` - Test package creation
- [ ] `test_calculate_wash_price` - Test pricing logic
- [ ] `test_start_wash_session` - Test session start
- [ ] `test_complete_wash_session` - Test session completion
- [ ] `test_wash_analytics` - Test analytics calculation

Estimated: 5 test cases, ~60 lines of test code

### Backend/app/verticals/carwash/routes.py (82 statements, 0% coverage)
**Priority:** HIGH - API endpoints

Test cases needed:
- [ ] `test_list_wash_packages_endpoint` - GET /wash/packages
- [ ] `test_create_wash_package_endpoint` - POST /wash/packages
- [ ] `test_start_wash_endpoint` - POST /wash/sessions
- [ ] `test_complete_wash_endpoint` - POST /wash/sessions/{id}/complete
- [ ] `test_wash_analytics_endpoint` - GET /wash/analytics

Estimated: 5 test cases, ~70 lines of test code

### Backend/app/verticals/carwash/module.py (56 statements, 0% coverage)
**Priority:** MEDIUM - Module initialization

Test cases needed:
- [ ] `test_carwash_module_registration` - Test module loads correctly
- [ ] `test_carwash_routes_mounted` - Verify routes are available

Estimated: 2 test cases, ~25 lines of test code

### Backend/app/verticals/carwash/migrations/carwash_001_initial.py (39 statements, 0% coverage)
**Priority:** LOW - Migration testing

Test cases needed:
- [ ] `test_carwash_migration_up` - Test migration applies
- [ ] `test_carwash_migration_down` - Test migration rollback

Estimated: 2 test cases, ~30 lines of test code

## Priority 4: Domain Verification (38 statements)

### Backend/app/routes/domain_verification.py (38 statements in uncovered sections)
**Priority:** MEDIUM - Multi-tenancy infrastructure

Test cases needed:
- [ ] `test_add_custom_domain` - Test domain addition
- [ ] `test_verify_domain_ownership` - Test DNS verification
- [ ] `test_list_tenant_domains` - Test domain listing
- [ ] `test_remove_custom_domain` - Test domain removal
- [ ] `test_domain_verification_errors` - Test error cases

Estimated: 5 test cases, ~55 lines of test code

## Implementation Strategy

### Week 1: Cache Infrastructure + Workers (Priority 1-2)
- Create `Backend/tests/test_cache_warmer.py`
- Create `Backend/tests/test_tenant_cache.py`
- Create `Backend/tests/test_workers.py`
- **Expected coverage gain:** ~15-18%

### Week 2: Carwash Vertical (Priority 3)
- Create `Backend/tests/verticals/test_carwash_models.py`
- Create `Backend/tests/verticals/test_carwash_services.py`
- Create `Backend/tests/verticals/test_carwash_routes.py`
- Create `Backend/tests/verticals/test_carwash_module.py`
- **Expected coverage gain:** ~10-12%

### Week 3: Domain Verification + Cleanup (Priority 4)
- Expand `Backend/tests/test_domain_verification.py`
- Add integration tests for multi-tenant scenarios
- **Expected coverage gain:** ~2-3%

## Success Metrics

- **Target:** 70% code coverage (from current 44%)
- **Quality gates:** All new tests must pass CI
- **Documentation:** Each test file should have docstrings explaining test scenarios
- **Maintenance:** Tests should be maintainable and not overly coupled to implementation

## Notes

- Focus on testing **behavior** not implementation details
- Use fixtures for common setup (tenant creation, user creation, etc.)
- Mock external dependencies (email, payment gateways, etc.)
- Test both success and failure scenarios
- Include edge cases and boundary conditions
