/**
 * Dispensary Category Management - Admin Page
 * Manage product categories for cannabis dispensary
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaFolder, FaSearch } from 'react-icons/fa';
import { useTenant } from '../../../config/TenantConfigProvider';
import '../../../styles/admin-modern.css';

interface Category {
  id: number;
  tenant_id: string;
  name: string;
  description?: string;
  icon?: string;
  display_order: number;
  requires_medical_card: boolean;
  active: boolean;
  created_at: string;
}

interface CategoryFormData {
  name: string;
  description: string;
  icon: string;
  display_order: string;
  requires_medical_card: boolean;
  active: boolean;
}

const CategoryManagement: React.FC = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; category: Category | null }>({ show: false, category: null });

  const initialFormData: CategoryFormData = {
    name: '',
    description: '',
    icon: '',
    display_order: '0',
    requires_medical_card: false,
    active: true,
  };

  const [formData, setFormData] = useState<CategoryFormData>(initialFormData);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['dispensary-categories-admin', tenantId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/dispensary/categories`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
    enabled: !!tenantId
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: any) => {
      const response = await fetch(`${API_BASE}/api/dispensary/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || ''
        },
        body: JSON.stringify(categoryData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create category');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['dispensary-categories'] });
      setShowAddForm(false);
      setFormData(initialFormData);
      alert('Category created successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`${API_BASE}/api/dispensary/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || ''
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update category');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['dispensary-categories'] });
      setEditingCategory(null);
      alert('Category updated successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      const response = await fetch(`${API_BASE}/api/dispensary/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to delete category');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['dispensary-categories'] });
      setDeleteConfirm({ show: false, category: null });
      alert('Category deleted successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Filter categories
  const filteredCategories = useMemo(() => {
    return categories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const categoryData = {
      name: formData.name,
      description: formData.description || undefined,
      icon: formData.icon || undefined,
      display_order: parseInt(formData.display_order),
      requires_medical_card: formData.requires_medical_card,
      active: formData.active,
    };

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryData });
    } else {
      createCategoryMutation.mutate(categoryData);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      display_order: category.display_order.toString(),
      requires_medical_card: category.requires_medical_card,
      active: category.active,
    });
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setFormData(initialFormData);
    setShowAddForm(false);
  };

  const handleDelete = (category: Category) => {
    setDeleteConfirm({ show: true, category });
  };

  const confirmDelete = () => {
    if (deleteConfirm.category) {
      deleteCategoryMutation.mutate(deleteConfirm.category.id);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>
            <FaFolder style={{ marginRight: '0.5rem' }} />
            Category Management
          </h1>
          <p>Manage product categories for your dispensary</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <FaPlus /> {showAddForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="admin-card" style={{ marginBottom: '2rem' }}>
          <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6">
                <div className="form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Flower, Edibles, Concentrates"
                  />
                </div>
              </div>

              <div className="col-md-3">
                <div className="form-group">
                  <label>Icon</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🌿"
                  />
                </div>
              </div>

              <div className="col-md-3">
                <div className="form-group">
                  <label>Display Order</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
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
                placeholder="Brief description of this category..."
              />
            </div>

            <div className="row">
              <div className="col-md-6">
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

              <div className="col-md-6">
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
                <FaSave /> {editingCategory ? 'Update Category' : 'Create Category'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                <FaTimes /> Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div className="form-group">
          <div className="input-group">
            <span className="input-group-text"><FaSearch /></span>
            <input
              type="text"
              className="form-control"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Categories List */}
      <div className="admin-card">
        <h3>Categories ({filteredCategories.length})</h3>
        
        {isLoading ? (
          <p>Loading categories...</p>
        ) : filteredCategories.length === 0 ? (
          <p>No categories found</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Icon</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Order</th>
                  <th>Medical Card</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map(category => (
                  <tr key={category.id}>
                    <td style={{ fontSize: '1.5rem' }}>{category.icon || '📁'}</td>
                    <td><strong>{category.name}</strong></td>
                    <td>{category.description || '-'}</td>
                    <td>{category.display_order}</td>
                    <td>
                      {category.requires_medical_card ? (
                        <span className="badge badge-warning">Required</span>
                      ) : (
                        <span className="badge badge-secondary">Not Required</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${category.active ? 'badge-success' : 'badge-secondary'}`}>
                        {category.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary mr-2"
                        onClick={() => handleEdit(category)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(category)}
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
      {deleteConfirm.show && deleteConfirm.category && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm({ show: false, category: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm({ show: false, category: null })}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this category?</p>
              <p><strong>{deleteConfirm.category.name}</strong></p>
              <p style={{ color: '#dc3545' }}>Warning: This will affect all products in this category.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm({ show: false, category: null })}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;
