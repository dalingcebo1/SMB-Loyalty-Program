# Vertical Extension Architecture Specification

## 1. Executive Summary
This document outlines the "Core + Extension" architecture. The goal is to maintain a single codebase where core logic (Auth, Points, Tenants) is shared, but vertical-specific workflows (Carwash PINs, Dispensary Delivery) are injected via a Plugin/Hook system.

**Key Principles:**
1.  **Backend Strategy Pattern:** The backend uses a Plugin Interface to delegate vertical-specific logic during core events (e.g., `on_redemption`).
2.  **Frontend Component Registry:** The frontend uses a Registry Pattern to dynamically render components based on the tenant's vertical and backend response signals.
3.  **Action-Driven UI:** The backend does not return UI; it returns "Actions" (Intent) that the frontend interprets.

---

## 2. Data Model Changes

### 2.1. Tenant Model (`Backend/app/models.py`)
We need to identify which vertical a tenant belongs to and store vertical-specific configuration.

```python
# Proposed Change to Tenant Model
class Tenant(Base):
    # ... existing fields ...
    
    # The vertical identifier (Enum)
    vertical = Column(String, default="retail", nullable=False) 
    
    # JSONB column for vertical-specific settings 
    # e.g., { "carwash_controller_ip": "10.0.0.5", "dispensary_license": "..." }
    plugin_config = Column(JSONB, default={}) 
```

### 2.2. Vertical Enum
```python
from enum import Enum

class VerticalType(str, Enum):
    RETAIL = "retail"
    CARWASH = "carwash"
    DISPENSARY = "dispensary"
```

---

## 3. Backend Architecture

### 3.1. The Plugin Interface (`Backend/app/plugins/interface.py`)
We define an abstract base class that all verticals must implement. This ensures type safety and consistent behavior.

```python
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class VerticalPluginBase(ABC):
    @abstractmethod
    def on_redemption_success(self, db: Session, tenant: Tenant, transaction: Transaction) -> Optional[Dict[str, Any]]:
        """
        Called after a successful point redemption.
        Returns a ClientAction dict or None.
        """
        pass

    @abstractmethod
    def get_custom_customer_fields(self) -> list[str]:
        """Returns list of extra fields required for this vertical's customers."""
        pass
```

### 3.2. The Plugin Registry (`Backend/app/plugins/registry.py`)
A factory to retrieve the correct plugin instance based on the tenant's vertical.

```python
_plugins = {}

def get_plugin(vertical: str) -> VerticalPluginBase:
    return _plugins.get(vertical, DefaultRetailPlugin())
```

### 3.3. API Response Standardization
We need a standard way to tell the frontend "Do this next." We will add a `client_action` field to relevant Pydantic response models.

```python
# Backend/app/schemas.py

class ClientAction(BaseModel):
    type: str  # e.g., "SHOW_PIN", "COLLECT_DELIVERY_INFO", "PRINT_RECEIPT"
    payload: Dict[str, Any] # e.g., { "pin_code": "1234" }

class RedemptionResponse(BaseModel):
    success: bool
    new_balance: int
    message: str
    client_action: Optional[ClientAction] = None
```

---

## 4. Frontend Architecture

### 4.1. The Component Registry (`Frontend/src/features/extensions/registry.tsx`)
We map "Action Types" (returned by backend) and "Slots" (locations in UI) to specific React Components.

```typescript
// Concept
const ExtensionRegistry = {
  [VerticalType.CARWASH]: {
    post_redemption: CarwashPinDisplay, // Component to show after redeem
    customer_profile_tab: VehicleInfoTab,
  },
  [VerticalType.DISPENSARY]: {
    post_redemption: DeliveryScheduler,
    customer_profile_tab: MedicalCardTab,
  }
};
```

### 4.2. The Extension Slot Component
A wrapper component used in Core pages to render dynamic content.

```tsx
// Usage in Core Page (e.g., RedemptionSuccess.tsx)
<ExtensionSlot 
  context="post_redemption" 
  data={backendResponse.client_action} 
/>
```

### 4.3. Vertical Context
A React Context provider that wraps the Staff App. It reads the `tenant.vertical` from the auth session and exposes it to the `ExtensionSlot`.

---

## 5. Detailed Workflow: "Carwash Redemption"

**Scenario:** A staff member redeems a "Gold Wash" for a customer.

1.  **Frontend:** Staff clicks "Redeem".
    *   `POST /api/transactions/redeem`
    *   Body: `{ reward_id: 5, customer_id: 10 }`

2.  **Backend (Core):**
    *   Validates points.
    *   Creates `Transaction` record.
    *   Deducts points.

3.  **Backend (Hook):**
    *   Core calls `plugin = get_plugin(tenant.vertical)` (returns `CarwashPlugin`).
    *   Core calls `plugin.on_redemption_success(db, tenant, tx)`.

4.  **Backend (Carwash Plugin):**
    *   Logic: Generates a random PIN `4591` for the wash controller.
    *   Returns: `{ type: "SHOW_PIN", payload: { pin: "4591", bay: "Any" } }`.

5.  **Backend (Core):**
    *   Merges plugin result into response.
    *   Returns JSON:
        ```json
        {
          "success": true,
          "new_balance": 500,
          "client_action": {
            "type": "SHOW_PIN",
            "payload": { "pin": "4591" }
          }
        }
        ```

6.  **Frontend:**
    *   Receives response.
    *   Checks `client_action.type` === `SHOW_PIN`.
    *   Looks up `SHOW_PIN` in Registry -> Finds `<PinDisplayModal />`.
    *   Renders `<PinDisplayModal pin="4591" />`.

---

## 6. Implementation Plan

### Phase 1: Backend Foundation (Core)
1.  **Migration:** Add `vertical` and `plugin_config` to `tenants` table.
2.  **Interface:** Create `Backend/app/plugins/interface.py` and `registry.py`.
3.  **Schema:** Update `RedemptionResponse` Pydantic model to include `client_action`.
4.  **Hook Integration:** Modify `Backend/app/routes/transactions.py` to call the plugin hook after success.

### Phase 2: Frontend Foundation (Core)
1.  **Context:** Create `VerticalContext` in [`Frontend/src/context`](Frontend/src/context ).
2.  **Registry:** Create `Frontend/src/features/extensions/registry.ts`.
3.  **Slot:** Create `<ExtensionSlot />` component.
4.  **Integration:** Update `StaffLayout` to provide the context.

### Phase 3: Carwash Implementation (Vertical A)
1.  **Backend:** Create `Backend/app/plugins/carwash/plugin.py`. Implement `on_redemption_success` to return a mock PIN.
2.  **Frontend:** Create `Frontend/src/features/extensions/carwash/PinDisplay.tsx`.
3.  **Wiring:** Register the component in the frontend registry.

### Phase 4: Dispensary Implementation (Vertical B)
1.  **Backend:** Create `Backend/app/plugins/dispensary/plugin.py`. Implement `on_redemption_success` to return `COLLECT_DELIVERY_INFO`.
2.  **Frontend:** Create `Frontend/src/features/extensions/dispensary/DeliveryForm.tsx`.
3.  **Wiring:** Register the component.

---

## 7. Directory Structure Snapshot

```text
Backend/
  app/
    models.py          <-- Tenant changes
    plugins/
      __init__.py
      interface.py     <-- Base Class
      registry.py      <-- Factory
      carwash/
        plugin.py      <-- Logic
      dispensary/
        plugin.py      <-- Logic

Frontend/
  src/
    features/
      extensions/
        ExtensionSlot.tsx
        registry.ts
        carwash/
          PinDisplay.tsx
        dispensary/
          DeliveryForm.tsx
```
