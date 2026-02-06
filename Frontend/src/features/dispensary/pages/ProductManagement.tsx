/**
 * Dispensary Product Management - Admin Page
 * Manage cannabis products with full CRUD operations
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaLeaf, FaSearch } from 'react-icons/fa';
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
  batch_number?: string;
  harvest_date?: string;
  package_date?: string;
  expiry_date?: string;
  requires_medical_card: boolean;
  potency_level?: 'low' | 'medium' | 'high' | 'very_high';
  image_url?: string;
  featured: boolean;
  display_order: number;
  active: boolean;
}

interface ProductFormData {
  category_id: string;
  name: string;
  strain: string;
  strain_type: string;
  description: string;
  sku: string;
  thc_percentage: string;
  cbd_percentage: string;
  terpenes: string;
  effects: string;
  medical_uses: string;
  price_cents: string;
  unit_size: string;
  stock_quantity: string;
  batch_number: string;
  harvest_date: string;
  package_date: string;
  expiry_date: string;
  requires_medical_card: boolean;
  potency_level: string;
  image_url: string;
  featured: boolean;
  display_order: string;
  active: boolean;
}

const toCents = (value: number) => Math.max(0, Math.round(Number(value || 0) * 100));
const centsToRand = (value: number) => Number((Number(value || 0) / 100).toFixed(2));

const ProductManagement: React.FC = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; product: Product | null }>({ show: false, product: null });

  const initialFormData: ProductFormData = {
    category_id: '',
    name: '',
    strain: '',
    strain_type: '',
    description: '',
    sku: '',
    thc_percentage: '',
    cbd_percentage: '',
    terpenes: '',
    effects: '',
    medical_uses: '',
    price_cents: '',
    unit_size: '',
    stock_quantity: '0',
    batch_number: '',
    harvest_date: '',
    package_date: '',
    expiry_date: '',
    requires_medical_card: false,
    potency_level: '',
    image_url: '',
    featured: false,
    display_order: '0',
    active: true,
  };

  const [formData, setFormData] = useState<ProductFormData>(initialFormData);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['dispensary-categories', tenantId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/dispensary/categories`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
    enabled: !!tenantId
  });

  // Fetch products
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['dispensary-products-admin', tenantId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/dispensary/products`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    enabled: !!tenantId
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const response = await fetch(`${API_BASE}/api/dispensary/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || ''
        },
        body: JSON.stringify(productData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create product');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary-products-admin'] });
      setShowAddForm(false);
      setFormData(initialFormData);
      alert('Product created successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`${API_BASE}/api/dispensary/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || ''
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update product');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary-products-admin'] });
      setEditingProduct(null);
      alert('Product updated successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await fetch(`${API_BASE}/api/dispensary/products/${productId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to delete product');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary-products-admin'] });
      setDeleteConfirm({ show: false, product: null });
      alert('Product deleted successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.strain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !filterCategory || product.category_id.toString() === filterCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, filterCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const productData = {
      category_id: parseInt(formData.category_id),
      name: formData.name,
      strain: formData.strain || undefined,
      strain_type: formData.strain_type || undefined,
      description: formData.description || undefined,
      sku: formData.sku || undefined,
      thc_percentage: formData.thc_percentage ? parseFloat(formData.thc_percentage) : undefined,
      cbd_percentage: formData.cbd_percentage ? parseFloat(formData.cbd_percentage) : undefined,
      terpenes: formData.terpenes || undefined,
      effects: formData.effects || undefined,
      medical_uses: formData.medical_uses || undefined,
      price_cents: toCents(parseFloat(formData.price_cents)),
      unit_size: formData.unit_size,
      stock_quantity: parseInt(formData.stock_quantity),
      batch_number: formData.batch_number || undefined,
      harvest_date: formData.harvest_date || undefined,
      package_date: formData.package_date || undefined,
      expiry_date: formData.expiry_date || undefined,
      requires_medical_card: formData.requires_medical_card,
      potency_level: formData.potency_level || undefined,
      image_url: formData.image_url || undefined,
      featured: formData.featured,
      display_order: parseInt(formData.display_order),
      active: formData.active,
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: productData });
    } else {
      createProductMutation.mutate(productData);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      category_id: product.category_id.toString(),
      name: product.name,
      strain: product.strain || '',
      strain_type: product.strain_type || '',
      description: product.description || '',
      sku: product.sku || '',
      thc_percentage: product.thc_percentage?.toString() || '',
      cbd_percentage: product.cbd_percentage?.toString() || '',
      terpenes: product.terpenes || '',
      effects: product.effects || '',
      medical_uses: product.medical_uses || '',
      price_cents: centsToRand(product.price_cents).toString(),
      unit_size: product.unit_size,
      stock_quantity: product.stock_quantity.toString(),
      batch_number: product.batch_number || '',
      harvest_date: product.harvest_date || '',
      package_date: product.package_date || '',
      expiry_date: product.expiry_date || '',
      requires_medical_card: product.requires_medical_card,
      potency_level: product.potency_level || '',
      image_url: product.image_url || '',
      featured: product.featured,
      display_order: product.display_order.toString(),
      active: product.active,
    });
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setFormData(initialFormData);
    setShowAddForm(false);
  };

  const handleDelete = (product: Product) => {
    setDeleteConfirm({ show: true, product });
  };

  const confirmDelete = () => {
    if (deleteConfirm.product) {
      deleteProductMutation.mutate(deleteConfirm.product.id);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>
            <FaLeaf style={{ marginRight: '0.5rem' }} />
            Product Management
          </h1>
          <p>Manage cannabis products and inventory</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <FaPlus /> {showAddForm ? 'Cancel' : 'Add Product'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="admin-card" style={{ marginBottom: '2rem' }}>
          <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    className="form-control"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-4">
                <div className="form-group">
                  <label>Strain</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.strain}
                    onChange={(e) => setFormData({ ...formData, strain: e.target.value })}
                  />
                </div>
              </div>

              <div className="col-md-4">
                <div className="form-group">
                  <label>Strain Type</label>
                  <select
                    className="form-control"
                    value={formData.strain_type}
                    onChange={(e) => setFormData({ ...formData, strain_type: e.target.value })}
                  >
                    <option value="">Select type</option>
                    <option value="indica">Indica</option>
                    <option value="sativa">Sativa</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="col-md-4">
                <div className="form-group">
                  <label>SKU</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3">
                <div className="form-group">
                  <label>THC %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="form-control"
                    value={formData.thc_percentage}
                    onChange={(e) => setFormData({ ...formData, thc_percentage: e.target.value })}
                  />
                </div>
              </div>

              <div className="col-md-3">
                <div className="form-group">
                  <label>CBD %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="form-control"
                    value={formData.cbd_percentage}
                    onChange={(e) => setFormData({ ...formData, cbd_percentage: e.target.value })}
                  />
                </div>
              </div>

              <div className="col-md-3">
                <div className="form-group">
                  <label>Potency Level</label>
                  <select
                    className="form-control"
                    value={formData.potency_level}
                    onChange={(e) => setFormData({ ...formData, potency_level: e.target.value })}
                  >
                    <option value="">Select level</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="very_high">Very High</option>
                  </select>
                </div>
              </div>

              <div className="col-md-3">
                <div className="form-group">
                  <label>Unit Size *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.unit_size}
                    onChange={(e) => setFormData({ ...formData, unit_size: e.target.value })}
                    placeholder="e.g., 3.5g, 7g, 1oz"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-4">
                <div className="form-group">
                  <label>Price (ZAR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={formData.price_cents}
                    onChange={(e) => setFormData({ ...formData, price_cents: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="col-md-4">
                <div className="form-group">
                  <label>Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="col-md-4">
                <div className="form-group">
                  <label>Batch Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-control"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Effects</label>
              <textarea
                className="form-control"
                value={formData.effects}
                onChange={(e) => setFormData({ ...formData, effects: e.target.value })}
                rows={2}
                placeholder="e.g., Relaxing, Euphoric, Creative"
              />
            </div>

            <div className="form-group">
              <label>Medical Uses</label>
              <textarea
                className="form-control"
                value={formData.medical_uses}
                onChange={(e) => setFormData({ ...formData, medical_uses: e.target.value })}
                rows={2}
                placeholder="e.g., Pain relief, Anxiety, Insomnia"
              />
            </div>

            <div className="form-group">
              <label>Terpenes</label>
              <input
                type="text"
                className="form-control"
                value={formData.terpenes}
                onChange={(e) => setFormData({ ...formData, terpenes: e.target.value })}
                placeholder="e.g., Myrcene, Limonene, Caryophyllene"
              />
            </div>

            <div className="form-group">
              <label>Image URL</label>
              <input
                type="url"
                className="form-control"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              />
            </div>

            <div className="row">
              <div className="col-md-4">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.requires_medical_card}
                      onChange={(e) => setFormData({ ...formData, requires_medical_card: e.target.checked })}
                    />
                    {' '}Requires Medical Card
                  </label>
                </div>
              </div>

              <div className="col-md-4">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    />
                    {' '}Featured Product
                  </label>
                </div>
              </div>

              <div className="col-md-4">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    />
                    {' '}Active
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                <FaSave /> {editingProduct ? 'Update Product' : 'Create Product'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                <FaTimes /> Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div className="row">
          <div className="col-md-6">
            <div className="form-group">
              <div className="input-group">
                <span className="input-group-text"><FaSearch /></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search products, strains, SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <select
              className="form-control"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="admin-card">
        <h3>Products ({filteredProducts.length})</h3>
        
        {isLoading ? (
          <p>Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p>No products found</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Strain</th>
                  <th>Type</th>
                  <th>THC%</th>
                  <th>CBD%</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      {product.featured && <span className="badge badge-warning ml-2">Featured</span>}
                      {product.requires_medical_card && <span className="badge badge-info ml-2">Rx</span>}
                    </td>
                    <td>{product.strain || '-'}</td>
                    <td>{product.strain_type || '-'}</td>
                    <td>{product.thc_percentage ? `${product.thc_percentage}%` : '-'}</td>
                    <td>{product.cbd_percentage ? `${product.cbd_percentage}%` : '-'}</td>
                    <td>{formatCents(product.price_cents)}</td>
                    <td>
                      {product.stock_quantity}
                      {product.stock_quantity === 0 && <span className="text-danger ml-2">Out of stock</span>}
                    </td>
                    <td>
                      <span className={`badge ${product.active ? 'badge-success' : 'badge-secondary'}`}>
                        {product.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary mr-2"
                        onClick={() => handleEdit(product)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(product)}
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.product && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm({ show: false, product: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm({ show: false, product: null })}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this product?</p>
              <p><strong>{deleteConfirm.product.name}</strong></p>
              <p style={{ color: '#dc3545' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm({ show: false, product: null })}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
