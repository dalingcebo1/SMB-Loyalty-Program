import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaMinus, FaTrash, FaCashRegister, FaCreditCard, FaMobileAlt, FaWallet, FaPrint, FaTimesCircle, FaUser, FaStar, FaTimes } from 'react-icons/fa';
import api from '../../../api/api';
import { formatCents } from '../../../utils/format';
import { AdminPageContainer } from '../../admin/components/AdminGrid';

interface Product {
  id: number;
  name: string;
  sku?: string;
  price_cents: number;
  category?: string;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  points?: number;
}

interface SaleItem {
  id?: number;
  product_id: number;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
  product_name: string;
  product_sku?: string;
}

interface Payment {
  amount_cents: number;
  payment_method: 'cash' | 'card' | 'mobile' | 'wallet';
  transaction_id?: string;
  change_given_cents: number;
}

interface Sale {
  id: number;
  receipt_number: string;
  customer_id?: number;
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  sale_status: string;
  payment_status: string;
  items: SaleItem[];
  sale_payments: Payment[];
}

const POSTerminal: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [cart, setCart] = useState<SaleItem[]>([]);
  
  // Customer lookup
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | 'wallet'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Search customers with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch) {
        searchCustomers(customerSearch);
      } else {
        setCustomers([]);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/retail/products');
      setProducts(response.data);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load products');
    }
  };

  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }
    
    try {
      const response = await api.get(`/api/customers?search=${encodeURIComponent(query)}&limit=10`);
      setCustomers(response.data.customers || []);
    } catch (err) {
      console.error('Failed to search customers:', err);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerSearch(false);
    setCustomerSearch('');
    setCustomers([]);
  };

  const removeCustomer = () => {
    setSelectedCustomer(null);
  };

  const createNewSale = async () => {
    try {
      const response = await api.post('/api/retail/pos/sales', {
        location: 'main',
        tax_rate: 1500, // 15% tax
        customer_id: selectedCustomer?.id || null,
      });
      setCurrentSale(response.data);
      setCart([]);
      return response.data;
    } catch (err) {
      console.error('Failed to create sale:', err);
      setError('Failed to create sale');
      return null;
    }
  };

  const addToCart = async (product: Product) => {
    setError('');
    
    // Create sale if none exists
    let sale = currentSale;
    if (!sale) {
      sale = await createNewSale();
      if (!sale) return;
    }

    try {
      // Check if product already in cart
      const existingItem = cart.find(item => item.product_id === product.id);
      
      if (existingItem) {
        // Update quantity by removing and re-adding
        await api.delete(`/api/retail/pos/sales/${sale.id}/items/${existingItem.id}`);
        const newQuantity = existingItem.quantity + 1;
        const response = await api.post(`/api/retail/pos/sales/${sale.id}/items`, {
          product_id: product.id,
          quantity: newQuantity,
          discount_cents: 0,
        });
        
        // Update cart
        setCart(cart.map(item => 
          item.product_id === product.id ? response.data : item
        ));
      } else {
        // Add new item
        const response = await api.post(`/api/retail/pos/sales/${sale.id}/items`, {
          product_id: product.id,
          quantity: 1,
          discount_cents: 0,
        });
        
        setCart([...cart, response.data]);
      }

      // Refresh sale to get updated totals
      const saleResponse = await api.get(`/api/retail/pos/sales/${sale.id}`);
      setCurrentSale(saleResponse.data);
      
      // Clear search
      setSearchTerm('');
      searchInputRef.current?.focus();
    } catch (err: any) {
      console.error('Failed to add item:', err);
      setError(err.response?.data?.detail || 'Failed to add item to cart');
    }
  };

  const updateQuantity = async (item: SaleItem, delta: number) => {
    if (!currentSale) return;
    
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) {
      removeFromCart(item);
      return;
    }

    try {
      // Remove old item
      await api.delete(`/api/retail/pos/sales/${currentSale.id}/items/${item.id}`);
      
      // Add with new quantity
      const response = await api.post(`/api/retail/pos/sales/${currentSale.id}/items`, {
        product_id: item.product_id,
        quantity: newQuantity,
        discount_cents: item.discount_cents,
      });
      
      // Update cart
      setCart(cart.map(i => i.id === item.id ? response.data : i));
      
      // Refresh sale totals
      const saleResponse = await api.get(`/api/retail/pos/sales/${currentSale.id}`);
      setCurrentSale(saleResponse.data);
    } catch (err: any) {
      console.error('Failed to update quantity:', err);
      setError(err.response?.data?.detail || 'Failed to update quantity');
    }
  };

  const removeFromCart = async (item: SaleItem) => {
    if (!currentSale) return;

    try {
      await api.delete(`/api/retail/pos/sales/${currentSale.id}/items/${item.id}`);
      setCart(cart.filter(i => i.id !== item.id));
      
      // Refresh sale totals
      const saleResponse = await api.get(`/api/retail/pos/sales/${currentSale.id}`);
      setCurrentSale(saleResponse.data);
    } catch (err) {
      console.error('Failed to remove item:', err);
      setError('Failed to remove item');
    }
  };

  const processPayment = async () => {
    if (!currentSale || cart.length === 0) return;
    
    setLoading(true);
    setError('');

    try {
      // Calculate payment amount
      let paymentAmount = currentSale.total_cents;
      if (paymentMethod === 'cash' && cashAmount) {
        paymentAmount = Math.round(parseFloat(cashAmount) * 100);
      }

      if (paymentAmount < currentSale.total_cents) {
        setError('Payment amount is less than sale total');
        setLoading(false);
        return;
      }

      // Add payment
      await api.post(`/api/retail/pos/sales/${currentSale.id}/payments`, {
        amount_cents: paymentAmount,
        payment_method: paymentMethod,
      });

      // Complete sale
      const response = await api.post(`/api/retail/pos/sales/${currentSale.id}/complete`);
      
      // Calculate points earned (if customer is selected and loyalty is enabled)
      // Assuming 0.1 accrual ratio (1 point per 10 cents, so R10 = 1000 cents = 100 points)
      if (selectedCustomer) {
        const estimatedPoints = Math.floor(currentSale.total_cents * 0.1);
        setPointsEarned(estimatedPoints);
      }
      
      // Show receipt
      setCompletedSale(response.data);
      setShowReceipt(true);
      
      // Reset for next sale
      setCurrentSale(null);
      setCart([]);
      setCashAmount('');
      setPaymentMethod('cash');
    } catch (err: any) {
      console.error('Failed to process payment:', err);
      setError(err.response?.data?.detail || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const voidSale = async () => {
    if (!currentSale) return;
    
    if (!confirm('Are you sure you want to void this sale?')) return;

    try {
      await api.post(`/api/retail/pos/sales/${currentSale.id}/void`);
      setCurrentSale(null);
      setCart([]);
      setCashAmount('');
    } catch (err) {
      console.error('Failed to void sale:', err);
      setError('Failed to void sale');
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setCompletedSale(null);
    setSelectedCustomer(null);
    setPointsEarned(0);
    searchInputRef.current?.focus();
  };

  // Filter products based on search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  // Calculate change for cash payments
  const change = paymentMethod === 'cash' && cashAmount 
    ? Math.max(0, Math.round(parseFloat(cashAmount) * 100) - (currentSale?.total_cents || 0))
    : 0;

  const canCompleteSale = currentSale && cart.length > 0 && (
    paymentMethod !== 'cash' || (cashAmount && parseFloat(cashAmount) * 100 >= currentSale.total_cents)
  );

  return (
    <AdminPageContainer title="POS Terminal">
      <div className="pos-terminal" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', height: 'calc(100vh - 200px)' }}>
        
        {/* Left Panel: Product Search & Cart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Customer Lookup */}
          <div className="card" style={{ padding: '20px', background: selectedCustomer ? '#f0fdf4' : '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <FaUser size={18} style={{ color: selectedCustomer ? '#16a34a' : '#6b7280' }} />
              <h2 style={{ margin: 0, fontSize: '16px', color: selectedCustomer ? '#16a34a' : '#374151' }}>
                {selectedCustomer ? 'Customer' : 'Add Customer (Optional)'}
              </h2>
            </div>
            
            {selectedCustomer ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                    {selectedCustomer.name}
                  </div>
                  {selectedCustomer.phone && (
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                      {selectedCustomer.phone}
                    </div>
                  )}
                  {selectedCustomer.points !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                      <FaStar size={12} style={{ color: '#f59e0b' }} />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#16a34a' }}>
                        {selectedCustomer.points} points
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={removeCustomer}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    background: '#fff',
                    color: '#dc2626',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FaTimes size={12} />
                  Remove
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onFocus={() => setShowCustomerSearch(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                  onBlur={() => setTimeout(() => setShowCustomerSearch(false), 200)}
                />
                
                {showCustomerSearch && customers.length > 0 && (
                  <div style={{
                    marginTop: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: '#fff',
                  }}>
                    {customers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        style={{
                          padding: '10px',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                      >
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{customer.name}</div>
                        {customer.phone && (
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{customer.phone}</div>
                        )}
                        {customer.points !== undefined && (
                          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '2px' }}>
                            ⭐ {customer.points} points
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Product Search */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <FaCashRegister size={20} style={{ color: '#2563eb' }} />
              <h2 style={{ margin: 0, fontSize: '18px' }}>Scan or Search Product</h2>
            </div>
            
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Enter SKU or product name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            
            {/* Product Suggestions */}
            {searchTerm && filteredProducts.length > 0 && (
              <div style={{
                marginTop: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}>
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      background: '#fff',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{product.name}</div>
                        {product.sku && (
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>SKU: {product.sku}</div>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, color: '#2563eb' }}>
                        {formatCents(product.price_cents)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shopping Cart */}
          <div className="card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
              Shopping Cart {cart.length > 0 && `(${cart.length})`}
            </h2>
            
            {error && (
              <div style={{
                padding: '12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                marginBottom: '15px',
              }}>
                {error}
              </div>
            )}
            
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px' }}>
              {cart.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#9ca3af',
                }}>
                  <FaCashRegister size={48} style={{ marginBottom: '10px', opacity: 0.3 }} />
                  <p>Cart is empty. Scan or search for products to begin.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {cart.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        background: '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                          {item.product_sku && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.product_sku}</div>
                          )}
                          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                            {formatCents(item.unit_price_cents)} × {item.quantity}
                          </div>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>
                          {formatCents(item.total_cents)}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => updateQuantity(item, -1)}
                          style={{
                            padding: '6px 10px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <FaMinus size={12} />
                        </button>
                        
                        <span style={{
                          padding: '6px 16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          background: '#f9fafb',
                          fontWeight: 500,
                        }}>
                          {item.quantity}
                        </span>
                        
                        <button
                          onClick={() => updateQuantity(item, 1)}
                          style={{
                            padding: '6px 10px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <FaPlus size={12} />
                        </button>
                        
                        <button
                          onClick={() => removeFromCart(item)}
                          style={{
                            marginLeft: 'auto',
                            padding: '6px 12px',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {cart.length > 0 && currentSale && (
              <button
                onClick={voidSale}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <FaTimesCircle style={{ marginRight: '8px' }} />
                Void Sale
              </button>
            )}
          </div>
        </div>

        {/* Right Panel: Payment & Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Sale Totals */}
          <div className="card" style={{ padding: '20px' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>Sale Total</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6b7280' }}>Subtotal:</span>
                <span>{formatCents(currentSale?.subtotal_cents || 0)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6b7280' }}>Tax (15%):</span>
                <span>{formatCents(currentSale?.tax_cents || 0)}</span>
              </div>
              
              <div style={{
                borderTop: '2px solid #e5e7eb',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '24px',
                fontWeight: 700,
                color: '#2563eb',
              }}>
                <span>Total:</span>
                <span>{formatCents(currentSale?.total_cents || 0)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="card" style={{ padding: '20px' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>Payment Method</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              {[
                { value: 'cash', icon: FaCashRegister, label: 'Cash' },
                { value: 'card', icon: FaCreditCard, label: 'Card' },
                { value: 'mobile', icon: FaMobileAlt, label: 'Mobile' },
                { value: 'wallet', icon: FaWallet, label: 'E-Wallet' },
              ].map(method => (
                <button
                  key={method.value}
                  onClick={() => setPaymentMethod(method.value as any)}
                  style={{
                    padding: '12px',
                    border: `2px solid ${paymentMethod === method.value ? '#2563eb' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    background: paymentMethod === method.value ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <method.icon size={20} color={paymentMethod === method.value ? '#2563eb' : '#6b7280'} />
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: paymentMethod === method.value ? '#2563eb' : '#374151',
                  }}>
                    {method.label}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Cash Amount Input */}
            {paymentMethod === 'cash' && (
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  Cash Amount (R)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '18px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    outline: 'none',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
                
                {change > 0 && (
                  <div style={{
                    marginTop: '10px',
                    padding: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#166534', fontWeight: 500 }}>Change:</span>
                    <span style={{ color: '#166534', fontWeight: 700, fontSize: '16px' }}>
                      {formatCents(change)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Complete Sale Button */}
          <button
            onClick={processPayment}
            disabled={!canCompleteSale || loading}
            style={{
              padding: '16px',
              border: 'none',
              borderRadius: '8px',
              background: canCompleteSale && !loading ? '#10b981' : '#d1d5db',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 600,
              cursor: canCompleteSale && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <FaCashRegister size={20} />
            {loading ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && completedSale && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{
            width: '400px',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: '30px',
            background: '#fff',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 10px 0' }}>Sale Complete!</h2>
              <div style={{ fontSize: '24px', color: '#10b981', fontWeight: 700 }}>
                {completedSale.receipt_number}
              </div>
            </div>
            
            <div style={{ borderTop: '2px dashed #e5e7eb', paddingTop: '15px', marginBottom: '15px' }}>
              {completedSale.items.map((item, idx) => (
                <div key={idx} style={{ marginBottom: '10px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.product_name}</span>
                    <span>{formatCents(item.total_cents)}</span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>
                    {item.quantity} × {formatCents(item.unit_price_cents)}
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ borderTop: '2px dashed #e5e7eb', paddingTop: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Subtotal:</span>
                <span>{formatCents(completedSale.subtotal_cents)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Tax:</span>
                <span>{formatCents(completedSale.tax_cents)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '18px',
                fontWeight: 700,
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '2px solid #111827',
              }}>
                <span>Total:</span>
                <span>{formatCents(completedSale.total_cents)}</span>
              </div>
              
              {completedSale.sale_payments.map((payment, idx) => (
                <div key={idx} style={{ marginTop: '10px', fontSize: '13px', color: '#6b7280' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Paid ({payment.payment_method}):</span>
                    <span>{formatCents(payment.amount_cents)}</span>
                  </div>
                  {payment.change_given_cents > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                      <span>Change:</span>
                      <span>{formatCents(payment.change_given_cents)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {pointsEarned > 0 && selectedCustomer && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                background: '#f0fdf4',
                border: '2px solid #86efac',
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FaStar size={18} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#16a34a' }}>
                    {pointsEarned} Points Earned!
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#166534' }}>
                  {selectedCustomer.name} earned {pointsEarned} loyalty points from this purchase
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '20px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
              Thank you for your purchase!
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={printReceipt}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <FaPrint style={{ marginRight: '8px' }} />
                Print
              </button>
              <button
                onClick={closeReceipt}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageContainer>
  );
};

export default POSTerminal;
