import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../../api/api';
import { FaTimes, FaSave } from 'react-icons/fa';
import './ProductForm.css';

interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  cost_cents: number;
  price_cents: number;
  barcode?: string;
  low_stock_threshold?: number;
  is_active: boolean;
  category_id?: number;
  supplier_id?: number;
}

interface Category {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

interface ProductFormProps {
  product: Product | null;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  product,
  categories,
  suppliers,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(product);

  const [formData, setFormData] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    category_id: product?.category_id || undefined,
    supplier_id: product?.supplier_id || undefined,
    cost: product ? (product.cost_cents / 100).toFixed(2) : '',
    price: product ? (product.price_cents / 100).toFixed(2) : '',
    barcode: product?.barcode || '',
    low_stock_threshold: product?.low_stock_threshold?.toString() || '',
    is_active: product?.is_active !== false,
    // Only for new products
    initial_stock_quantity: '',
    initial_stock_location: 'main',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/api/retail/products', data);
      return response.data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create product';
      setErrors({ form: message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.patch(`/api/retail/products/${product!.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update product';
      setErrors({ form: message });
    },
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.sku.trim()) newErrors.sku = 'SKU is required';
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.cost || parseFloat(formData.cost) < 0) newErrors.cost = 'Valid cost is required';
    if (!formData.price || parseFloat(formData.price) < 0) newErrors.price = 'Valid price is required';
    
    const cost = parseFloat(formData.cost || '0');
    const price = parseFloat(formData.price || '0');
    if (price < cost) {
      newErrors.price = 'Price cannot be less than cost';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const costCents = Math.round(parseFloat(formData.cost) * 100);
    const priceCents = Math.round(parseFloat(formData.price) * 100);

    const payload: any = {
      sku: formData.sku.trim(),
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      cost_cents: costCents,
      price_cents: priceCents,
      barcode: formData.barcode.trim() || undefined,
      low_stock_threshold: formData.low_stock_threshold 
        ? parseInt(formData.low_stock_threshold) 
        : undefined,
      is_active: formData.is_active,
      category_id: formData.category_id || undefined,
      supplier_id: formData.supplier_id || undefined,
    };

    if (!isEdit && formData.initial_stock_quantity) {
      payload.initial_stock = {
        quantity: parseInt(formData.initial_stock_quantity),
        location: formData.initial_stock_location,
      };
    }

    if (isEdit) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const margin = formData.cost && formData.price 
    ? (((parseFloat(formData.price) - parseFloat(formData.cost)) / parseFloat(formData.price)) * 100).toFixed(1)
    : '0';

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="btn-close" type="button">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.form && (
              <div className="alert alert-error">
                {errors.form}
              </div>
            )}

            <div className="form-grid">
              {/* Column 1 */}
              <div className="form-column">
                <div className="form-group">
                  <label htmlFor="sku">
                    SKU <span className="required">*</span>
                  </label>
                  <input
                    id="sku"
                    type="text"
                    value={formData.sku}
                    onChange={(e) => handleChange('sku', e.target.value)}
                    placeholder="e.g., PROD-001"
                    disabled={isEdit || isPending}
                    className={errors.sku ? 'error' : ''}
                  />
                  {errors.sku && <span className="error-text">{errors.sku}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="name">
                    Product Name <span className="required">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g., Premium Widget"
                    disabled={isPending}
                    className={errors.name ? 'error' : ''}
                  />
                  {errors.name && <span className="error-text">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Product description..."
                    rows={3}
                    disabled={isPending}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    value={formData.category_id || ''}
                    onChange={(e) => handleChange('category_id', e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={isPending}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="supplier">Supplier</label>
                  <select
                    id="supplier"
                    value={formData.supplier_id || ''}
                    onChange={(e) => handleChange('supplier_id', e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={isPending}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Column 2 */}
              <div className="form-column">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="cost">
                      Cost (R) <span className="required">*</span>
                    </label>
                    <input
                      id="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost}
                      onChange={(e) => handleChange('cost', e.target.value)}
                      placeholder="0.00"
                      disabled={isPending}
                      className={errors.cost ? 'error' : ''}
                    />
                    {errors.cost && <span className="error-text">{errors.cost}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="price">
                      Price (R) <span className="required">*</span>
                    </label>
                    <input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => handleChange('price', e.target.value)}
                      placeholder="0.00"
                      disabled={isPending}
                      className={errors.price ? 'error' : ''}
                    />
                    {errors.price && <span className="error-text">{errors.price}</span>}
                  </div>
                </div>

                <div className="margin-display">
                  <span className="margin-label">Profit Margin:</span>
                  <span className={`margin-value ${parseFloat(margin) >= 30 ? 'good' : parseFloat(margin) >= 15 ? 'ok' : 'low'}`}>
                    {margin}%
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="barcode">Barcode / UPC</label>
                  <input
                    id="barcode"
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => handleChange('barcode', e.target.value)}
                    placeholder="Scan or enter barcode"
                    disabled={isPending}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="threshold">Low Stock Threshold</label>
                  <input
                    id="threshold"
                    type="number"
                    min="0"
                    value={formData.low_stock_threshold}
                    onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                    placeholder="e.g., 10"
                    disabled={isPending}
                  />
                  <span className="help-text">Alert when stock falls below this level</span>
                </div>

                {!isEdit && (
                  <>
                    <div className="form-group">
                      <label htmlFor="initial_stock">Initial Stock Quantity</label>
                      <input
                        id="initial_stock"
                        type="number"
                        min="0"
                        value={formData.initial_stock_quantity}
                        onChange={(e) => handleChange('initial_stock_quantity', e.target.value)}
                        placeholder="0"
                        disabled={isPending}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="location">Stock Location</label>
                      <input
                        id="location"
                        type="text"
                        value={formData.initial_stock_location}
                        onChange={(e) => handleChange('initial_stock_location', e.target.value)}
                        placeholder="main"
                        disabled={isPending}
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => handleChange('is_active', e.target.checked)}
                      disabled={isPending}
                    />
                    <span>Active (visible in POS)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
            >
              {isPending ? (
                <>Saving...</>
              ) : (
                <>
                  <FaSave /> {isEdit ? 'Update Product' : 'Create Product'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
