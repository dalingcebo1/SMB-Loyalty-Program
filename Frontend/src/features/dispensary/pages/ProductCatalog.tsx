/**
 * Cannabis Dispensary Product Catalog
 * Browse products, filter by category/strain, add to cart, checkout with compliance checks
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FaSearch, 
  FaShoppingCart, 
  FaTimes, 
  FaPlus, 
  FaMinus,
  FaLeaf,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle
} from 'react-icons/fa';
import { useAuth } from '../../../auth/AuthProvider';
import { useTenant } from '../../../config/TenantConfigProvider';
import { formatCents } from '../../../utils/format';
import '../../../styles/admin-modern.css';

interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  requires_medical_card: boolean;
  active: boolean;
}

interface Product {
  id: number;
  category_id: number;
  name: string;
  strain?: string;
  strain_type?: 'indica' | 'sativa' | 'hybrid';
  description?: string;
  sku?: string;
  thc_percentage?: number;
  cbd_percentage?: number;
  terpenes?: string;
  effects?: string;
  medical_uses?: string;
  price_cents: number;
  unit_size: string;
  stock_quantity: number;
  requires_medical_card: boolean;
  potency_level?: 'low' | 'medium' | 'high' | 'very_high';
  image_url?: string;
  featured: boolean;
  active: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Verification {
  id: number;
  customer_id: number;
  age_verified: boolean;
  has_medical_card: boolean;
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired';
}

interface PurchaseLimits {
  daily_limit_grams: number;
  monthly_limit_grams: number;
  daily_purchased_grams: number;
  monthly_purchased_grams: number;
  daily_remaining_grams: number;
  monthly_remaining_grams: number;
  can_purchase: boolean;
}

const ProductCatalog: React.FC = () => {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedStrainType, setSelectedStrainType] = useState<string>('');
  const [selectedPotency, setSelectedPotency] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');

  // API Base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['dispensary-categories', tenantId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/dispensary/categories?active_only=true`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
    enabled: !!tenantId
  });

  // Fetch products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['dispensary-products', tenantId, selectedCategory, selectedStrainType, selectedPotency],
    queryFn: async () => {
      const params = new URLSearchParams({
        active_only: 'true',
        ...(selectedCategory && { category_id: selectedCategory.toString() }),
        ...(selectedStrainType && { strain_type: selectedStrainType }),
        ...(selectedPotency && { potency_level: selectedPotency })
      });
      
      const response = await fetch(`${API_BASE}/api/dispensary/products?${params}`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    enabled: !!tenantId
  });

  // Fetch customer verification
  const { data: verification } = useQuery<Verification>({
    queryKey: ['dispensary-verification', tenantId, user?.id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/dispensary/verifications/${user?.id}`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch verification');
      }
      return response.json();
    },
    enabled: !!tenantId && !!user?.id
  });

  // Fetch purchase limits
  const { data: purchaseLimits } = useQuery<PurchaseLimits>({
    queryKey: ['dispensary-purchase-limits', tenantId, user?.id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/dispensary/purchase-limits/${user?.id}`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch purchase limits');
      return response.json();
    },
    enabled: !!tenantId && !!user?.id
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const response = await fetch(`${API_BASE}/api/dispensary/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || ''
        },
        body: JSON.stringify(saleData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create sale');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary-products'] });
      queryClient.invalidateQueries({ queryKey: ['dispensary-purchase-limits'] });
      setCart([]);
      setShowCheckout(false);
      alert('Purchase completed successfully! Thank you for your order.');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.strain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  // Cart functions
  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price_cents * item.quantity), 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const handleCheckout = () => {
    // Validation checks
    if (!verification || verification.verification_status !== 'verified') {
      alert('You must complete age verification before making a purchase.');
      return;
    }

    if (!purchaseLimits?.can_purchase) {
      alert('You have reached your daily or monthly purchase limit.');
      return;
    }

    // Check if any product requires medical card
    const requiresMedicalCard = cart.some(item => item.product.requires_medical_card);
    if (requiresMedicalCard && !verification.has_medical_card) {
      alert('Some products in your cart require a medical card. Please update your verification.');
      return;
    }

    setShowCheckout(true);
  };

  const submitOrder = () => {
    if (!user || !tenantId) return;

    const saleData = {
      customer_id: user.id,
      staff_id: user.id, // In real scenario, this would be a different staff member
      payment_method: paymentMethod,
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity
      }))
    };

    createSaleMutation.mutate(saleData);
  };

  // Verification status badge
  const VerificationBadge = () => {
    if (!verification) {
      return (
        <div className="alert alert-warning">
          <FaExclamationTriangle /> Age verification required
        </div>
      );
    }

    if (verification.verification_status === 'verified') {
      return (
        <div className="alert alert-success">
          <FaCheckCircle /> Age verified
          {verification.has_medical_card && ' • Medical card on file'}
        </div>
      );
    }

    return (
      <div className="alert alert-danger">
        <FaExclamationTriangle /> Verification {verification.verification_status}
      </div>
    );
  };

  // Purchase limits display
  const PurchaseLimitsDisplay = () => {
    if (!purchaseLimits) return null;

    return (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h5>Purchase Limits</h5>
          <div style={{ fontSize: '0.9rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Daily:</strong> {purchaseLimits.daily_purchased_grams.toFixed(1)}g / {purchaseLimits.daily_limit_grams.toFixed(1)}g
              <div style={{ background: '#e0e0e0', height: '8px', borderRadius: '4px', marginTop: '4px' }}>
                <div 
                  style={{ 
                    background: '#4caf50', 
                    height: '100%', 
                    width: `${(purchaseLimits.daily_purchased_grams / purchaseLimits.daily_limit_grams) * 100}%`,
                    borderRadius: '4px'
                  }} 
                />
              </div>
            </div>
            <div>
              <strong>Monthly:</strong> {purchaseLimits.monthly_purchased_grams.toFixed(1)}g / {purchaseLimits.monthly_limit_grams.toFixed(1)}g
              <div style={{ background: '#e0e0e0', height: '8px', borderRadius: '4px', marginTop: '4px' }}>
                <div 
                  style={{ 
                    background: '#2196f3', 
                    height: '100%', 
                    width: `${(purchaseLimits.monthly_purchased_grams / purchaseLimits.monthly_limit_grams) * 100}%`,
                    borderRadius: '4px'
                  }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Product card component
  const ProductCard: React.FC<{ product: Product }> = ({ product }) => (
    <div className="card product-card" onClick={() => setSelectedProduct(product)}>
      <div className="card-body">
        {product.image_url && (
          <img 
            src={product.image_url} 
            alt={product.name}
            style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }}
          />
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h5 style={{ margin: 0 }}>{product.name}</h5>
          {product.requires_medical_card && (
            <span className="badge badge-warning" title="Requires medical card">
              <FaLeaf /> Rx
            </span>
          )}
        </div>

        {product.strain && (
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
            <strong>{product.strain}</strong>
            {product.strain_type && ` • ${product.strain_type}`}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          {product.thc_percentage !== undefined && (
            <span className="badge badge-info">THC: {product.thc_percentage}%</span>
          )}
          {product.cbd_percentage !== undefined && (
            <span className="badge badge-info">CBD: {product.cbd_percentage}%</span>
          )}
          {product.potency_level && (
            <span className={`badge ${
              product.potency_level === 'very_high' ? 'badge-danger' :
              product.potency_level === 'high' ? 'badge-warning' :
              product.potency_level === 'medium' ? 'badge-success' :
              'badge-secondary'
            }`}>
              {product.potency_level.replace('_', ' ')}
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
          Unit: {product.unit_size}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <div className="price">{formatCents(product.price_cents)}</div>
          <button
            className="btn btn-primary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product);
            }}
            disabled={product.stock_quantity === 0}
          >
            {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );

  // Product detail modal
  const ProductDetailModal = () => {
    if (!selectedProduct) return null;

    return (
      <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
          <div className="modal-header">
            <h3>{selectedProduct.name}</h3>
            <button className="modal-close" onClick={() => setSelectedProduct(null)}>
              <FaTimes />
            </button>
          </div>

          <div className="modal-body">
            {selectedProduct.image_url && (
              <img 
                src={selectedProduct.image_url} 
                alt={selectedProduct.name}
                style={{ width: '100%', height: '250px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }}
              />
            )}

            <div style={{ marginBottom: '1rem' }}>
              {selectedProduct.strain && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Strain:</strong> {selectedProduct.strain}
                  {selectedProduct.strain_type && ` (${selectedProduct.strain_type})`}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {selectedProduct.thc_percentage !== undefined && (
                  <span className="badge badge-info">THC: {selectedProduct.thc_percentage}%</span>
                )}
                {selectedProduct.cbd_percentage !== undefined && (
                  <span className="badge badge-info">CBD: {selectedProduct.cbd_percentage}%</span>
                )}
                {selectedProduct.potency_level && (
                  <span className={`badge ${
                    selectedProduct.potency_level === 'very_high' ? 'badge-danger' :
                    selectedProduct.potency_level === 'high' ? 'badge-warning' :
                    selectedProduct.potency_level === 'medium' ? 'badge-success' :
                    'badge-secondary'
                  }`}>
                    Potency: {selectedProduct.potency_level.replace('_', ' ')}
                  </span>
                )}
              </div>

              {selectedProduct.description && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Description:</strong>
                  <p style={{ marginTop: '0.5rem' }}>{selectedProduct.description}</p>
                </div>
              )}

              {selectedProduct.effects && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Effects:</strong>
                  <p style={{ marginTop: '0.5rem' }}>{selectedProduct.effects}</p>
                </div>
              )}

              {selectedProduct.terpenes && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Terpenes:</strong>
                  <p style={{ marginTop: '0.5rem' }}>{selectedProduct.terpenes}</p>
                </div>
              )}

              {selectedProduct.medical_uses && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Medical Uses:</strong>
                  <p style={{ marginTop: '0.5rem' }}>{selectedProduct.medical_uses}</p>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <strong>Unit Size:</strong> {selectedProduct.unit_size}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <strong>Stock:</strong> {selectedProduct.stock_quantity} available
              </div>

              {selectedProduct.requires_medical_card && (
                <div className="alert alert-warning">
                  <FaLeaf /> This product requires a medical card
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
              <div className="price" style={{ fontSize: '1.5rem' }}>
                {formatCents(selectedProduct.price_cents)}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                disabled={selectedProduct.stock_quantity === 0}
              >
                {selectedProduct.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Shopping cart modal
  const ShoppingCartModal = () => (
    <div className="modal-overlay" onClick={() => setShowCart(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Shopping Cart ({cartItemCount} items)</h3>
          <button className="modal-close" onClick={() => setShowCart(false)}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          {cart.length === 0 ? (
            <p>Your cart is empty</p>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.product.id} className="cart-item" style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1rem',
                  borderBottom: '1px solid #ddd'
                }}>
                  <div style={{ flex: 1 }}>
                    <strong>{item.product.name}</strong>
                    {item.product.strain && <div style={{ fontSize: '0.9rem', color: '#666' }}>{item.product.strain}</div>}
                    <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                      {formatCents(item.product.price_cents)} × {item.quantity} = {formatCents(item.product.price_cents * item.quantity)}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button className="btn btn-sm" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                      <FaMinus />
                    </button>
                    <span style={{ minWidth: '2rem', textAlign: 'center' }}>{item.quantity}</span>
                    <button className="btn btn-sm" onClick={() => updateQuantity(item.product.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock_quantity}>
                      <FaPlus />
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => removeFromCart(item.product.id)}>
                      <FaTimes />
                    </button>
                  </div>
                </div>
              ))}

              <div style={{ padding: '1rem', borderTop: '2px solid #333', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}>
                  <span>Total:</span>
                  <span>{formatCents(cartTotal)}</span>
                </div>

                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: '1rem' }}
                  onClick={handleCheckout}
                >
                  Proceed to Checkout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Checkout modal
  const CheckoutModal = () => (
    <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Checkout</h3>
          <button className="modal-close" onClick={() => setShowCheckout(false)}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          <h4>Order Summary</h4>
          {cart.map(item => (
            <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>{item.product.name} × {item.quantity}</span>
              <span>{formatCents(item.product.price_cents * item.quantity)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #ddd', marginTop: '1rem', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Subtotal:</span>
              <span>{formatCents(cartTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Tax (10%):</span>
              <span>{formatCents(Math.floor(cartTotal * 0.1))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', borderTop: '2px solid #333', paddingTop: '0.5rem' }}>
              <span>Total:</span>
              <span>{formatCents(cartTotal + Math.floor(cartTotal * 0.1))}</span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h4>Payment Method</h4>
            <div className="form-group">
              <label>
                <input
                  type="radio"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card')}
                />
                {' '}Card
              </label>
              <label style={{ marginLeft: '1rem' }}>
                <input
                  type="radio"
                  value="cash"
                  checked={paymentMethod === 'cash'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card')}
                />
                {' '}Cash
              </label>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            <FaInfoCircle /> By completing this purchase, you confirm that you are of legal age and have been verified.
          </div>

          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: '1rem' }}
            onClick={submitOrder}
            disabled={createSaleMutation.isPending}
          >
            {createSaleMutation.isPending ? 'Processing...' : 'Complete Purchase'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container">
      <div className="page-header">
        <h1>
          <FaLeaf /> Cannabis Products
        </h1>
        <p>Browse our selection of premium cannabis products</p>
      </div>

      {/* Verification & Limits Status */}
      <div className="row" style={{ marginBottom: '1.5rem' }}>
        <div className="col-md-6">
          <VerificationBadge />
        </div>
        <div className="col-md-6">
          <PurchaseLimitsDisplay />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <div className="form-group">
                <div className="input-group">
                  <span className="input-group-text"><FaSearch /></span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <select
                className="form-control"
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-control"
                value={selectedStrainType}
                onChange={(e) => setSelectedStrainType(e.target.value)}
              >
                <option value="">All Strains</option>
                <option value="indica">Indica</option>
                <option value="sativa">Sativa</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-control"
                value={selectedPotency}
                onChange={(e) => setSelectedPotency(e.target.value)}
              >
                <option value="">All Potency</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="very_high">Very High</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Shopping Cart Button */}
      <button
        className="floating-cart-button"
        onClick={() => setShowCart(true)}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: '#2196f3',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontSize: '1.5rem',
          zIndex: 1000
        }}
      >
        <FaShoppingCart />
        {cartItemCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#f44336',
            color: 'white',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 'bold'
          }}>
            {cartItemCount}
          </span>
        )}
      </button>

      {/* Product Grid */}
      <div className="row">
        {filteredProducts.length === 0 ? (
          <div className="col-12">
            <div className="card">
              <div className="card-body text-center">
                <p>No products found</p>
              </div>
            </div>
          </div>
        ) : (
          filteredProducts.map(product => (
            <div key={product.id} className="col-md-4 col-lg-3" style={{ marginBottom: '1.5rem' }}>
              <ProductCard product={product} />
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {selectedProduct && <ProductDetailModal />}
      {showCart && <ShoppingCartModal />}
      {showCheckout && <CheckoutModal />}
    </div>
  );
};

export default ProductCatalog;
