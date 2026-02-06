import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';
import { AdminPageContainer } from '../../admin/components/AdminGrid';
import { ProductList } from '../components/ProductList';
import { ProductForm } from '../components/ProductForm';
import { LowStockAlerts } from '../components/LowStockAlerts';
import { formatCurrency } from '../../../utils/format';
import { 
  FaBoxes, 
  FaExclamationTriangle, 
  FaDollarSign, 
  FaPlus,
  FaTruck,
  FaTags
} from 'react-icons/fa';
import './InventoryDashboard.css';

interface InventoryStats {
  total_products: number;
  low_stock_count: number;
  total_inventory_value_cents: number;
  total_suppliers: number;
  total_categories: number;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  cost_cents: number;
  price_cents: number;
  margin: number;
  barcode?: string;
  low_stock_threshold?: number;
  is_active: boolean;
  category?: {
    id: number;
    name: string;
  };
  supplier?: {
    id: number;
    name: string;
  };
  inventory_levels: {
    location: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
  }[];
  low_stock_alerts: any[];
}

export const InventoryDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Fetch inventory stats
  const { data: stats } = useQuery<InventoryStats>({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const response = await api.get('/api/retail/stats');
      return response.data;
    },
  });

  // Fetch products
  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['retail-products', { search: searchTerm, category: selectedCategory, lowStockOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category_id', selectedCategory.toString());
      if (lowStockOnly) params.append('low_stock_only', 'true');
      
      const response = await api.get(`/api/retail/products?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ['retail-categories'],
    queryFn: async () => {
      const response = await api.get('/api/retail/categories');
      return response.data;
    },
  });

  // Fetch suppliers for filter
  const { data: suppliers = [] } = useQuery({
    queryKey: ['retail-suppliers'],
    queryFn: async () => {
      const response = await api.get('/api/retail/suppliers');
      return response.data;
    },
  });

  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setIsProductFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsProductFormOpen(true);
  };

  const handleFormClose = () => {
    setIsProductFormOpen(false);
    setSelectedProduct(null);
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['retail-products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    handleFormClose();
  };

  const lowStockCount = stats?.low_stock_count || 0;
  const totalValue = stats?.total_inventory_value_cents || 0;

  return (
    <AdminPageContainer
      title="Inventory Management"
      description="Manage products, stock levels, and suppliers"
    >
      <div className="inventory-dashboard">
        {/* Stats Cards */}
        <div className="inventory-stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <FaBoxes />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Products</div>
              <div className="stat-value">{stats?.total_products || 0}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className={`stat-icon ${lowStockCount > 0 ? 'warning' : 'success'}`}>
              <FaExclamationTriangle />
            </div>
            <div className="stat-content">
              <div className="stat-label">Low Stock Items</div>
              <div className="stat-value">{lowStockCount}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <FaDollarSign />
            </div>
            <div className="stat-content">
              <div className="stat-label">Inventory Value</div>
              <div className="stat-value">{formatCurrency(totalValue / 100)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon info">
              <FaTruck />
            </div>
            <div className="stat-content">
              <div className="stat-label">Suppliers</div>
              <div className="stat-value">{stats?.total_suppliers || 0}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon info">
              <FaTags />
            </div>
            <div className="stat-content">
              <div className="stat-label">Categories</div>
              <div className="stat-value">{stats?.total_categories || 0}</div>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        {lowStockCount > 0 && (
          <div className="low-stock-section">
            <LowStockAlerts />
          </div>
        )}

        {/* Filters and Actions */}
        <div className="inventory-controls">
          <div className="inventory-filters">
            <input
              type="text"
              placeholder="Search by SKU, name, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />

            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              <span>Low Stock Only</span>
            </label>
          </div>

          <button
            onClick={handleCreateProduct}
            className="btn btn-primary"
          >
            <FaPlus /> Add Product
          </button>
        </div>

        {/* Product List */}
        <ProductList
          products={products}
          loading={loadingProducts}
          onEdit={handleEditProduct}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['retail-products'] });
          }}
        />

        {/* Product Form Modal */}
        {isProductFormOpen && (
          <ProductForm
            product={selectedProduct}
            categories={categories}
            suppliers={suppliers}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        )}
      </div>
    </AdminPageContainer>
  );
};
