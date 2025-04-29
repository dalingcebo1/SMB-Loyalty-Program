#!/usr/bin/env bash
set -e

# 1) Remove any existing frontend folder and scaffold a new Vite+React+TS app
rm -rf frontend
npm create vite@latest frontend -- --template react-ts
cd frontend

# 2) Install routing, HTTP client, and QR library
npm install react-router-dom axios qrcode.react

# 3) Create our directory structure
mkdir -p src/pages src/components src/api src/utils src/types

# 4) Scaffold the main pages
for page in Onboarding Services Cart Payment QrScreen StaffDashboard; do
  cat > src/pages/${page}.tsx <<EOF
import React from "react";

export const ${page}: React.FC = () => {
  return (
    <div>
      <h1>${page}</h1>
      {/* TODO: implement ${page} */}
    </div>
  );
};
EOF
done

# 5) Shared UI components

cat > src/components/Header.tsx <<EOF
import React from "react";
import { Link } from "react-router-dom";

export const Header: React.FC = () => (
  <header>
    <nav>
      <Link to="/">Home</Link>{" | "}
      <Link to="/services">Services</Link>{" | "}
      <Link to="/cart">Cart</Link>{" | "}
      <Link to="/staff">Staff</Link>
    </nav>
  </header>
);
EOF

cat > src/components/ServiceList.tsx <<EOF
import React from "react";

export type Service = {
  id: number;
  name: string;
  base_price: number;
};

export const ServiceList: React.FC<{
  services: Service[];
  onAdd: (service: Service) => void;
}> = ({ services, onAdd }) => (
  <ul>
    {services.map((s) => (
      <li key={s.id}>
        \${s.base_price / 100} — {s.name}{" "}
        <button onClick={() => onAdd(s)}>Add to Cart</button>
      </li>
    ))}
  </ul>
);
EOF

cat > src/components/CartSummary.tsx <<EOF
import React from "react";

export type CartItem = {
  serviceId: number;
  name: string;
  price: number;
  qty: number;
};

export const CartSummary: React.FC<{
  items: CartItem[];
  onRemove: (serviceId: number) => void;
}> = ({ items, onRemove }) => {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return (
    <div>
      <h2>Cart</h2>
      <ul>
        {items.map((i) => (
          <li key={i.serviceId}>
            {i.name} x{i.qty} — \${(i.price * i.qty) / 100}{" "}
            <button onClick={() => onRemove(i.serviceId)}>Remove</button>
          </li>
        ))}
      </ul>
      <p>Total: \${total / 100}</p>
    </div>
  );
};
EOF

cat > src/components/PaymentButtons.tsx <<EOF
import React from "react";

export const PaymentButtons: React.FC<{
  onGooglePay: () => void;
  onApplePay: () => void;
}> = ({ onGooglePay, onApplePay }) => (
  <div>
    <button onClick={onGooglePay}>Google Pay</button>
    <button onClick={onApplePay}>Apple Pay</button>
  </div>
);
EOF

cat > src/components/QrViewer.tsx <<EOF
import React from "react";

export const QrViewer: React.FC<{ data: string }> = ({ data }) => (
  <div>
    <img src={data} alt="Scan to validate payment" />
  </div>
);
EOF

cat > src/components/OrdersTable.tsx <<EOF
import React from "react";

export type OrderSummary = {
  id: number;
  user_id: number;
  total_amount: number;
  status: string;
};

export const OrdersTable: React.FC<{
  orders: OrderSummary[];
  onSelect: (id: number) => void;
}> = ({ orders, onSelect }) => (
  <table>
    <thead>
      <tr>
        <th>Order ID</th>
        <th>User ID</th>
        <th>Total</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      {orders.map((o) => (
        <tr key={o.id}>
          <td>{o.id}</td>
          <td>{o.user_id}</td>
          <td>\${o.total_amount / 100}</td>
          <td>{o.status}</td>
          <td>
            <button onClick={() => onSelect(o.id)}>Open</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
EOF

# 6) API client setup
cat > src/api/api.ts <<EOF
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
});
EOF

# 7) App routing in App.tsx
cat > src/App.tsx <<'EOF'
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { Onboarding } from "./pages/Onboarding";
import { Services }   from "./pages/Services";
import { Cart }       from "./pages/Cart";
import { Payment }    from "./pages/Payment";
import { QrScreen }   from "./pages/QrScreen";
import { StaffDashboard } from "./pages/StaffDashboard";

export const App: React.FC = () => (
  <BrowserRouter>
    <Header />
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/services" element={<Services />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/qr" element={<QrScreen />} />
      <Route path="/staff" element={<StaffDashboard />} />
    </Routes>
  </BrowserRouter>
);
export default App;
EOF

# 8) Entry point in main.tsx
cat > src/main.tsx <<EOF
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# 9) Types placeholder
cat > src/types/index.ts <<EOF
export type Service = {
  id: number;
  name: string;
  base_price: number;
};

export type Extra = {
  id: number;
  name: string;
  price_map: Record<string, number>;
};
EOF

echo "✅ Front-end scaffold complete!"
echo "Run the following to start your app:"
echo "  cd frontend"
echo "  npm install"
echo "  npm run dev"
