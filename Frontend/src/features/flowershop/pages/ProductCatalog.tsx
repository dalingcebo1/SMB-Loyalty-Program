import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FaShoppingCart,
  FaFilter,
  FaTimes,
  FaPlus,
  FaMinus,
  FaCheck,
} from 'react-icons/fa';
import api from '../../../api/api';
import { useTenant } from '../../../config/TenantConfigProvider';
import { useAuth } from '../../../auth/AuthProvider';
import { formatCents } from '../../../utils/format';

interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  display_order: number;
  active: boolean;
}

interface Occasion {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color_scheme?: string;
  active: boolean;
}

interface Product {
  id: number;
  category_id: number;
  name: string;
  description?: string;
  sku?: string;
  price_cents: number;
  sale_price_cents?: number;
  stock_quantity: number;
  track_inventory: boolean;
  low_stock_threshold: number;
  size?: string;
  color_scheme?: string;
  includes_vase: boolean;
  includes_card: boolean;
  image_url?: string;
  featured: boolean;
  seasonal: boolean;
  active: boolean;
  available_for_delivery: boolean;
  available_for_pickup: boolean;
  occasions: Occasion[];
}

interface OrderItem {
  product_id: number;
  quantity: number;
}

interface CartItem extends OrderItem {
  product: Product;
}

interface YocoResult {
  id: string;
  status: string;
  error?: { message?: string };
  [key: string]: unknown;
}

interface OrderConfirmation {
  orderId: number;
  orderNumber: string;
  paymentStatus: string;
  totalCents: number;
}

declare global {
  interface Window {
    YocoSDK: {
      new (options: { publicKey: string }): {
        showPopup: (options: {
          amountInCents: number;
          currency: string;
          name: string;
          description: string;
          callback: (result: YocoResult) => void;
        }) => void;
      };
    };
  }
}

export default function ProductCatalog() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [showSeasonalOnly, setShowSeasonalOnly] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  // Checkout form state
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0] // Tomorrow
  );
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<string>('9AM-12PM');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [includeSenderName, setIncludeSenderName] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('card');

  // Payment state
  const [yocoLoaded, setYocoLoaded] = useState(false);
  const [paying, setPaying] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const publicKey = import.meta.env.VITE_YOCO_PUBLIC_KEY as string | undefined;

  // Load Yoco SDK
  useEffect(() => {
    if (window.YocoSDK) {
      setYocoLoaded(true);
      return;
    }

    const scriptId = 'yoco-sdk';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://js.yoco.com/sdk/v1/yoco-sdk-web.js';
      script.async = true;
      script.onload = () => setYocoLoaded(true);
      script.onerror = () => setYocoLoaded(true); // proceed even if SDK fails
      document.body.appendChild(script);
    } else {
      existing.onload = () => setYocoLoaded(true);
    }
  }, []);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['flowershop', 'categories', tenantId],
    queryFn: async () => {
      const response = await api.get('/api/flowershop/categories');
      return response.data as Category[];
    },
    enabled: !!tenantId,
  });

  // Fetch occasions
  const { data: occasions = [] } = useQuery({
    queryKey: ['flowershop', 'occasions', tenantId],
    queryFn: async () => {
      const response = await api.get('/api/flowershop/occasions');
      return response.data as Occasion[];
    },
    enabled: !!tenantId,
  });

  // Fetch products with filters
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: [
      'flowershop',
      'products',
      tenantId,
      selectedCategory,
      selectedOccasion,
      searchQuery,
      showFeaturedOnly,
      showSeasonalOnly,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category_id', selectedCategory.toString());
      if (selectedOccasion) params.append('occasion_id', selectedOccasion.toString());
      if (searchQuery) params.append('search', searchQuery);
      if (showFeaturedOnly) params.append('featured_only', 'true');
      if (showSeasonalOnly) params.append('seasonal_only', 'true');

      const response = await api.get(`/api/flowershop/products?${params.toString()}`);
      return response.data as Product[];
    },
    enabled: !!tenantId,
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const orderData = {
        customer_id: user.id,
        delivery_type: deliveryType,
        delivery_date: deliveryDate,
        delivery_time_slot: deliveryType === 'delivery' ? deliveryTimeSlot : null,
        recipient_name: recipientName,
        recipient_phone: recipientPhone || null,
        delivery_address_line1: deliveryType === 'delivery' ? addressLine1 : null,
        delivery_address_line2: deliveryType === 'delivery' ? addressLine2 : null,
        delivery_city: deliveryType === 'delivery' ? city : null,
        delivery_postal_code: deliveryType === 'delivery' ? postalCode : null,
        delivery_instructions: deliveryType === 'delivery' ? deliveryInstructions : null,
        gift_message: giftMessage || null,
        include_sender_name: includeSenderName,
        payment_method: paymentMethod,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      };

      const response = await api.post('/api/flowershop/orders', orderData);
      return response.data as {
        id: number;
        order_number: string;
        total_cents: number;
        payment_status: string;
        payment_method: string;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flowershop', 'orders'] });

      if (data.payment_method === 'card') {
        // Initiate Yoco payment
        initiateYocoPayment(data.id, data.order_number, data.total_cents);
      } else {
        // Cash/EFT — order stays pending for staff confirmation
        setCart([]);
        setShowCheckout(false);
        setShowCart(false);
        setPaymentError(null);
        setOrderConfirmation({
          orderId: data.id,
          orderNumber: data.order_number,
          paymentStatus: 'pending',
          totalCents: data.total_cents,
        });
      }
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Failed to place order';
      setPaymentError(message);
    },
  });

  const initiateYocoPayment = useCallback(
    (orderId: number, orderNumber: string, totalCents: number) => {
      setPaymentError(null);

      if (!publicKey || !window.YocoSDK) {
        setPaymentError(
          'Payment system is not available. Please try again or choose a different payment method.'
        );
        return;
      }

      setPaying(true);

      try {
        const popup = new window.YocoSDK({ publicKey });
        popup.showPopup({
          amountInCents: totalCents,
          currency: 'ZAR',
          name: 'Flower Order Payment',
          description: `Order #${orderNumber}`,
          callback: async (result: YocoResult) => {
            if (result.error) {
              setPaying(false);
              setPaymentError(result.error.message || 'Payment failed. Please try again.');
              return;
            }

            try {
              const payResponse = await api.post(
                `/api/flowershop/orders/${orderId}/pay`,
                { token: result.id }
              );

              setPaying(false);
              setCart([]);
              setShowCheckout(false);
              setShowCart(false);
              setOrderConfirmation({
                orderId: payResponse.data.order_id,
                orderNumber: payResponse.data.order_number,
                paymentStatus: payResponse.data.payment_status,
                totalCents: payResponse.data.total_cents,
              });
            } catch (error: unknown) {
              setPaying(false);
              const message =
                (error as { response?: { data?: { detail?: string } } })?.response
                  ?.data?.detail || 'Payment could not be completed. Please contact support.';
              setPaymentError(message);
            }
          },
        });
      } catch {
        setPaying(false);
        setPaymentError('Unexpected error starting payment. Please try again.');
      }
    },
    [publicKey]
  );

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product_id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([...cart, { product_id: product.id, quantity: 1, product }]);
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product_id === productId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => {
      const price = item.product.sale_price_cents || item.product.price_cents;
      return sum + price * item.quantity;
    }, 0);

    const deliveryFee = deliveryType === 'delivery' ? 5000 : 0; // R50 delivery fee
    return { subtotal, deliveryFee, total: subtotal + deliveryFee };
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }
    if (!user) {
      alert('Please login to place an order');
      return;
    }
    setShowCheckout(true);
    setShowCart(false);
  };

  const handlePlaceOrder = () => {
    if (!recipientName) {
      alert('Please enter recipient name');
      return;
    }

    if (deliveryType === 'delivery') {
      if (!addressLine1 || !city || !postalCode) {
        alert('Please enter delivery address');
        return;
      }
    }

    if (giftMessage && giftMessage.length > 200) {
      alert('Gift message must be 200 characters or less');
      return;
    }

    setPaymentError(null);
    createOrderMutation.mutate();
  };

  const { subtotal, deliveryFee, total } = calculateTotal();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                🌸 Flower Shop
              </h1>
              <p className="text-gray-600 mt-1">Browse our beautiful collection</p>
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="relative bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition flex items-center gap-2"
            >
              <FaShoppingCart />
              Cart
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FaFilter className="text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Category filter */}
            <div>
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Occasion filter */}
            <div>
              <select
                value={selectedOccasion || ''}
                onChange={(e) => setSelectedOccasion(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">All Occasions</option>
                {occasions.map((occasion) => (
                  <option key={occasion.id} value={occasion.id}>
                    {occasion.icon} {occasion.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick filters */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  showFeaturedOnly
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ⭐ Featured
              </button>
              <button
                onClick={() => setShowSeasonalOnly(!showSeasonalOnly)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  showSeasonalOnly
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🌟 Seasonal
              </button>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {loadingProducts ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-600 border-t-transparent"></div>
            <p className="text-gray-600 mt-4">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const inCart = cart.find((item) => item.product_id === product.id);
              const isLowStock =
                product.track_inventory && product.stock_quantity <= product.low_stock_threshold;
              const isOutOfStock = product.track_inventory && product.stock_quantity === 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  {/* Product Image */}
                  <div className="relative h-48 bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-6xl">💐</div>
                    )}
                    {product.featured && (
                      <div className="absolute top-2 left-2 bg-yellow-400 text-gray-900 px-2 py-1 rounded text-xs font-bold">
                        ⭐ Featured
                      </div>
                    )}
                    {product.seasonal && (
                      <div className="absolute top-2 right-2 bg-purple-500 text-white px-2 py-1 rounded text-xs font-bold">
                        🌟 Seasonal
                      </div>
                    )}
                    {product.sale_price_cents && (
                      <div className="absolute bottom-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                        SALE
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {/* Details */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {product.size && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {product.size}
                        </span>
                      )}
                      {product.color_scheme && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {product.color_scheme}
                        </span>
                      )}
                      {product.includes_vase && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          🏺 Vase
                        </span>
                      )}
                      {product.includes_card && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          💌 Card
                        </span>
                      )}
                    </div>

                    {/* Occasions */}
                    {product.occasions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {product.occasions.map((occasion) => (
                          <span
                            key={occasion.id}
                            className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded"
                          >
                            {occasion.icon} {occasion.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-baseline gap-2 mb-3">
                      {product.sale_price_cents ? (
                        <>
                          <span className="text-xl font-bold text-pink-600">
                            {formatCents(product.sale_price_cents)}
                          </span>
                          <span className="text-sm text-gray-500 line-through">
                            {formatCents(product.price_cents)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xl font-bold text-gray-900">
                          {formatCents(product.price_cents)}
                        </span>
                      )}
                    </div>

                    {/* Stock Status */}
                    {isOutOfStock ? (
                      <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm font-medium text-center">
                        Out of Stock
                      </div>
                    ) : isLowStock ? (
                      <div className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded text-sm mb-2 text-center">
                        Only {product.stock_quantity} left!
                      </div>
                    ) : null}

                    {/* Add to Cart Button */}
                    {!isOutOfStock && (
                      <button
                        onClick={() => addToCart(product)}
                        disabled={inCart !== undefined}
                        className={`w-full px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                          inCart
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-pink-600 text-white hover:bg-pink-700'
                        }`}
                      >
                        {inCart ? (
                          <>
                            <FaCheck /> In Cart ({inCart.quantity})
                          </>
                        ) : (
                          <>
                            <FaShoppingCart /> Add to Cart
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cart Modal */}
        {showCart && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Cart Header */}
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FaShoppingCart className="text-pink-600" />
                  Shopping Cart
                </h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-6">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🛒</div>
                    <p className="text-gray-500 text-lg">Your cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => {
                      const price = item.product.sale_price_cents || item.product.price_cents;
                      return (
                        <div
                          key={item.product_id}
                          className="flex gap-4 p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="w-20 h-20 bg-gradient-to-br from-pink-100 to-purple-100 rounded flex items-center justify-center text-3xl flex-shrink-0">
                            {item.product.image_url ? (
                              <img
                                src={item.product.image_url}
                                alt={item.product.name}
                                className="w-full h-full object-cover rounded"
                              />
                            ) : (
                              '💐'
                            )}
                          </div>

                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                            <p className="text-sm text-gray-600">{item.product.size}</p>
                            <p className="text-pink-600 font-semibold mt-1">
                              {formatCents(price)}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.product_id, -1)}
                                className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center"
                              >
                                <FaMinus className="text-sm" />
                              </button>
                              <span className="w-8 text-center font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.product_id, 1)}
                                disabled={
                                  item.product.track_inventory &&
                                  item.quantity >= item.product.stock_quantity
                                }
                                className="w-8 h-8 bg-pink-600 hover:bg-pink-700 text-white rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <FaPlus className="text-sm" />
                              </button>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.product_id)}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              <FaTimes /> Remove
                            </button>
                            <p className="font-bold text-gray-900">
                              {formatCents(price * item.quantity)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="p-6 border-t bg-gray-50">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal:</span>
                      <span className="font-semibold">{formatCents(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>Delivery Fee:</span>
                      <span className="font-semibold">{formatCents(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-pink-600">{formatCents(total)}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleCheckout}
                    className="w-full bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition font-semibold"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Checkout Modal - Will create in next todo */}
        {showCheckout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Checkout Header */}
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>

              {/* Checkout Form */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Delivery Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Type
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setDeliveryType('delivery')}
                        className={`p-4 border-2 rounded-lg font-medium transition ${
                          deliveryType === 'delivery'
                            ? 'border-pink-600 bg-pink-50 text-pink-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        🚚 Delivery
                      </button>
                      <button
                        onClick={() => setDeliveryType('pickup')}
                        className={`p-4 border-2 rounded-lg font-medium transition ${
                          deliveryType === 'pickup'
                            ? 'border-pink-600 bg-pink-50 text-pink-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        🏪 Pickup
                      </button>
                    </div>
                  </div>

                  {/* Delivery Date & Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {deliveryType === 'delivery' ? 'Delivery' : 'Pickup'} Date *
                      </label>
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        required
                      />
                    </div>
                    {deliveryType === 'delivery' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Time Slot
                        </label>
                        <select
                          value={deliveryTimeSlot}
                          onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        >
                          <option value="9AM-12PM">9AM - 12PM</option>
                          <option value="12PM-3PM">12PM - 3PM</option>
                          <option value="3PM-6PM">3PM - 6PM</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Recipient Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Recipient Name *
                      </label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Recipient Phone
                      </label>
                      <input
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      />
                    </div>
                  </div>

                  {/* Delivery Address (if delivery) */}
                  {deliveryType === 'delivery' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 1 *
                        </label>
                        <input
                          type="text"
                          value={addressLine1}
                          onChange={(e) => setAddressLine1(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 2
                        </label>
                        <input
                          type="text"
                          value={addressLine2}
                          onChange={(e) => setAddressLine2(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            City *
                          </label>
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Postal Code *
                          </label>
                          <input
                            type="text"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Delivery Instructions
                        </label>
                        <textarea
                          value={deliveryInstructions}
                          onChange={(e) => setDeliveryInstructions(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                          placeholder="e.g., Ring bell, leave at door, etc."
                        />
                      </div>
                    </div>
                  )}

                  {/* Gift Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gift Message (max 200 characters)
                    </label>
                    <textarea
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      maxLength={200}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      placeholder="Your personal message..."
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={includeSenderName}
                          onChange={(e) => setIncludeSenderName(e.target.checked)}
                          className="rounded text-pink-600 focus:ring-pink-500"
                        />
                        Include my name
                      </label>
                      <span>{giftMessage.length}/200</span>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="card">💳 Credit/Debit Card</option>
                      <option value="cash">💵 Cash on Delivery</option>
                      <option value="eft">🏦 EFT</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Checkout Footer */}
              <div className="p-6 border-t bg-gray-50">
                {/* Order item summary */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Order Summary</h3>
                  <div className="space-y-1">
                    {cart.map((item) => {
                      const price = item.product.sale_price_cents || item.product.price_cents;
                      return (
                        <div key={item.product_id} className="flex justify-between text-sm text-gray-600">
                          <span>{item.product.name} × {item.quantity}</span>
                          <span>{formatCents(price * item.quantity)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatCents(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Delivery Fee:</span>
                    <span className="font-semibold">{formatCents(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-pink-600">{formatCents(total)}</span>
                  </div>
                </div>
                {paymentError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {paymentError}
                  </div>
                )}
                <button
                  onClick={handlePlaceOrder}
                  disabled={createOrderMutation.isPending || paying || (paymentMethod === 'card' && !yocoLoaded)}
                  className="w-full bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition font-semibold disabled:opacity-50"
                >
                  {createOrderMutation.isPending || paying
                    ? 'Processing...'
                    : paymentMethod === 'card'
                      ? `Pay Now ${formatCents(total)} 💳`
                      : 'Place Order 🌸'}
                </button>
                {paymentMethod !== 'card' && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {paymentMethod === 'cash'
                      ? 'Payment will be collected on delivery/pickup. Staff will confirm your order.'
                      : 'Please complete EFT payment using the details provided. Staff will confirm once received.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Order Confirmation */}
        {orderConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
              <div className="text-6xl mb-4">
                {orderConfirmation.paymentStatus === 'paid' ? '✅' : '📋'}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {orderConfirmation.paymentStatus === 'paid'
                  ? 'Payment Successful!'
                  : 'Order Placed!'}
              </h2>
              <p className="text-gray-600 mb-4">
                {orderConfirmation.paymentStatus === 'paid'
                  ? 'Your order has been confirmed and is being prepared.'
                  : 'Your order is pending. Our staff will confirm it shortly.'}
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span>Order Number:</span>
                  <span className="font-bold text-pink-600">
                    {orderConfirmation.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Total:</span>
                  <span className="font-semibold">
                    {formatCents(orderConfirmation.totalCents)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Status:</span>
                  <span
                    className={`font-semibold ${
                      orderConfirmation.paymentStatus === 'paid'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {orderConfirmation.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOrderConfirmation(null)}
                className="w-full bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition font-semibold"
              >
                Continue Shopping 🌸
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
