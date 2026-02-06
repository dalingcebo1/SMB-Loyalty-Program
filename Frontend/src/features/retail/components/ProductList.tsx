import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';
import { formatCurrency } from '../../../utils/format';
import { 
  FaEdit, 
  FaTrash, 
  FaExclamationTriangle, 
  FaCheckCircle,
  FaBoxes,
  FaChartLine
} from 'react-icons/fa';
import './ProductList.css';

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

interface ProductListProps {
  products: Product[];
  loading: boolean;
  onEdit: (product: Product) => void;
  onRefresh: () => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  loading,
  onEdit,
  onRefresh,
}) => {
  const queryClient = useQueryClient();
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      await api.delete(`/api/retail/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    },
  });

  const handleDelete = async (product: Product) => {
    if (window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
      await deleteMutation.mutateAsync(product.id);
    }
  };

  const getAvailableStock = (product: Product) => {
    return product.inventory_levels.reduce((sum, level) => sum + level.available_quantity, 0);
  };

  const isLowStock = (product: Product) => {
    if (!product.low_stock_threshold) return false;
    const available = getAvailableStock(product);
    return available <= product.low_stock_threshold;
  };

  const toggleExpand = (productId: number) => {
    setExpandedProduct(expandedProduct === productId ? null : productId);
  };

  if (loading) {
    return (
      <div className="product-list-loading">
        <div className="spinner"></div>
        <p>Loading products...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="product-list-empty">
        <FaBoxes className="empty-icon" />
        <h3>No products found</h3>
        <p>Create your first product to get started</p>
      </div>
    );
  }

  return (
    <div className="product-list-container">
      <div className="product-list-header">
        <h3>Products ({products.length})</h3>
        <button onClick={onRefresh} className="btn-refresh" title="Refresh">
          <FaChartLine />
        </button>
      </div>

      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Category</th>
              <th>Supplier</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Price</th>
              <th className="text-right">Margin</th>
              <th className="text-center">Stock</th>
              <th className="text-center">Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <React.Fragment key={product.id}>
                <tr 
                  className={`product-row ${expandedProduct === product.id ? 'expanded' : ''}`}
                  onClick={() => toggleExpand(product.id)}
                >
                  <td>
                    <code className="sku-code">{product.sku}</code>
                  </td>
                  <td>
                    <div className="product-name">
                      {product.name}
                      {isLowStock(product) && (
                        <FaExclamationTriangle className="low-stock-icon" title="Low stock" />
                      )}
                    </div>
                    {product.description && (
                      <div className="product-description">{product.description}</div>
                    )}
                  </td>
                  <td>
                    <span className="category-badge">
                      {product.category?.name || 'Uncategorized'}
                    </span>
                  </td>
                  <td>
                    {product.supplier?.name || '-'}
                  </td>
                  <td className="text-right">
                    {formatCurrency(product.cost_cents / 100)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(product.price_cents / 100)}
                  </td>
                  <td className="text-right">
                    <span className={`margin-badge ${product.margin >= 30 ? 'good' : product.margin >= 15 ? 'ok' : 'low'}`}>
                      {product.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`stock-badge ${isLowStock(product) ? 'low' : 'normal'}`}>
                      {getAvailableStock(product)}
                    </span>
                  </td>
                  <td className="text-center">
                    {product.is_active ? (
                      <FaCheckCircle className="status-icon active" title="Active" />
                    ) : (
                      <span className="status-badge inactive">Inactive</span>
                    )}
                  </td>
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="action-buttons">
                      <button
                        onClick={() => onEdit(product)}
                        className="btn-icon btn-edit"
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="btn-icon btn-delete"
                        title="Delete"
                        disabled={deleteMutation.isPending}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded Row Details */}
                {expandedProduct === product.id && (
                  <tr className="product-details-row">
                    <td colSpan={10}>
                      <div className="product-details">
                        <div className="details-section">
                          <h4>Inventory by Location</h4>
                          {product.inventory_levels.length > 0 ? (
                            <table className="inventory-table">
                              <thead>
                                <tr>
                                  <th>Location</th>
                                  <th>Total</th>
                                  <th>Reserved</th>
                                  <th>Available</th>
                                </tr>
                              </thead>
                              <tbody>
                                {product.inventory_levels.map((level) => (
                                  <tr key={level.location}>
                                    <td>{level.location}</td>
                                    <td>{level.quantity}</td>
                                    <td>{level.reserved_quantity}</td>
                                    <td className="font-semibold">{level.available_quantity}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="no-data">No inventory recorded</p>
                          )}
                        </div>

                        <div className="details-section">
                          <h4>Product Details</h4>
                          <dl className="details-list">
                            {product.barcode && (
                              <>
                                <dt>Barcode</dt>
                                <dd><code>{product.barcode}</code></dd>
                              </>
                            )}
                            {product.low_stock_threshold && (
                              <>
                                <dt>Low Stock Threshold</dt>
                                <dd>{product.low_stock_threshold} units</dd>
                              </>
                            )}
                            <dt>Profit per Unit</dt>
                            <dd>{formatCurrency((product.price_cents - product.cost_cents) / 100)}</dd>
                          </dl>
                        </div>

                        {product.low_stock_alerts.length > 0 && (
                          <div className="details-section alert-section">
                            <h4>Active Alerts</h4>
                            <div className="alert-list">
                              {product.low_stock_alerts.map((alert) => (
                                <div key={alert.id} className="alert-item">
                                  <FaExclamationTriangle />
                                  <span>
                                    Stock below threshold ({alert.current_quantity} / {alert.threshold})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
