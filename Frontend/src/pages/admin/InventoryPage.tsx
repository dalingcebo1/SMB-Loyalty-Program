import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../api/api';
import { useCapabilities } from '../../features/admin/hooks/useCapabilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ServiceItem {
  id: number;
  category: string;
  name: string;
  base_price: number;
  loyalty_eligible: boolean;
}

interface ExtraItem {
  id: number;
  name: string;
  price_map: Record<string, number>;
}

const CURRENCY_LOCALE = 'en-ZA';
const CURRENCY_CODE = 'ZAR';
const CENT_FACTOR = 100;

const EMPTY_SERVICES: ServiceItem[] = [];
const EMPTY_EXTRAS: ExtraItem[] = [];

const toCents = (value: number) => Math.max(0, Math.round(Number(value || 0) * CENT_FACTOR));
const centsToRand = (value: number) => Number((Number(value || 0) / CENT_FACTOR).toFixed(2));

// Helper to convert API price map to UI tiers array
const priceMapToTiers = (priceMap: Record<string, number>) => {
  return Object.entries(priceMap).map(([name, cents]) => ({
    name,
    price: centsToRand(cents).toString()
  }));
};

// Helper to convert UI tiers array to API price map
const tiersToPriceMap = (tiers: { name: string; price: string }[]) => {
  const map: Record<string, number> = {};
  tiers.forEach(t => {
    if (t.name && t.price) {
      map[t.name] = toCents(Number(t.price));
    }
  });
  return map;
};

// Icons
const Icons = {
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  ChevronDown: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  ChevronRight: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  Refresh: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  AlertCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  CheckCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

const InventoryPage: React.FC = () => {
  const [submitting, setSubmitting] = useState(false);
  
  // Service Form State
  const [isAddingService, setIsAddingService] = useState(false);
  const [serviceForm, setServiceForm] = useState({ category: '', name: '', base_price: '', loyalty_eligible: false });
  
  // Extra Form State
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [extraFormName, setExtraFormName] = useState('');
  const [extraFormTiers, setExtraFormTiers] = useState<{name: string, price: string}[]>([{name: 'Standard', price: ''}]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filters
  const [serviceFilter, setServiceFilter] = useState('');
  const [extraFilter, setExtraFilter] = useState('');
  
  // Editing States
  const [editingService, setEditingService] = useState<number | null>(null);
  const [editingServiceDraft, setEditingServiceDraft] = useState<Partial<ServiceItem> & { base_price_display?: string }>({});
  
  const [editingExtra, setEditingExtra] = useState<number | null>(null);
  const [editingExtraDraftName, setEditingExtraDraftName] = useState('');
  const [editingExtraDraftTiers, setEditingExtraDraftTiers] = useState<{name: string, price: string}[]>([]);

  // UI States
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'service' | 'extra';
    id: number;
    name: string;
  }>({ isOpen: false, type: 'service', id: 0, name: '' });

  const { has: hasCapability } = useCapabilities();
  const canManageInventory = hasCapability('services.manage');
  const queryClient = useQueryClient();

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: CURRENCY_CODE }),
    []
  );
  const formatCurrency = useCallback((cents: number) => currencyFormatter.format(cents / CENT_FACTOR), [currencyFormatter]);

  // Queries
  const servicesQuery = useQuery<ServiceItem[]>({
    queryKey: ['inventory', 'services'],
    queryFn: async () => {
      const { data } = await api.get<{ services: ServiceItem[] }>('/inventory/services');
      return data?.services ?? [];
    },
    enabled: canManageInventory,
  });

  const extrasQuery = useQuery<ExtraItem[]>({
    queryKey: ['inventory', 'extras'],
    queryFn: async () => {
      const { data } = await api.get<{ extras: ExtraItem[] }>('/inventory/extras');
      return data?.extras ?? [];
    },
    enabled: canManageInventory,
  });

  const services = useMemo(() => servicesQuery.data ?? EMPTY_SERVICES, [servicesQuery.data]);
  const extras = useMemo(() => extrasQuery.data ?? EMPTY_EXTRAS, [extrasQuery.data]);
  
  const loading = servicesQuery.isFetching || extrasQuery.isFetching;
  const displayError = error || (servicesQuery.error as Error)?.message || (extrasQuery.error as Error)?.message;

  const refreshInventory = useCallback(() => {
    if (!canManageInventory) return;
    servicesQuery.refetch();
    extrasQuery.refetch();
  }, [canManageInventory, servicesQuery, extrasQuery]);

  // --- Service Actions ---

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const price = Number(serviceForm.base_price);
      if (price < 0) throw new Error('Price must be >= 0');
      
      const payload = {
        category: serviceForm.category.trim(),
        name: serviceForm.name.trim(),
        base_price: toCents(price),
        loyalty_eligible: serviceForm.loyalty_eligible,
      };
      
      await api.post('/inventory/services', payload);
      setServiceForm({ category: '', name: '', base_price: '', loyalty_eligible: false });
      setSuccess('Service created successfully');
      setIsAddingService(false);
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'services'] });
    } catch (err) {
      console.error('Create service failed', err);
      setError('Could not create service');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteService(id: number) {
    const service = services.find(s => s.id === id);
    if (!service) return;
    setDeleteConfirm({ isOpen: true, type: 'service', id, name: service.name });
  }

  async function confirmDeleteService() {
    if (!deleteConfirm.isOpen || deleteConfirm.type !== 'service') return;
    setSubmitting(true);
    try {
      await api.delete(`/inventory/services/${deleteConfirm.id}`);
      setSuccess('Service deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'services'] });
    } catch {
      setError('Failed to delete service');
    } finally { 
      setSubmitting(false); 
      setDeleteConfirm({ isOpen: false, type: 'service', id: 0, name: '' });
    }
  }

  function startEditService(s: ServiceItem) {
    setEditingService(s.id);
    setEditingServiceDraft({
      ...s,
      base_price_display: centsToRand(s.base_price).toString()
    });
  }

  async function saveEditService() {
    if (editingService == null) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {};
      if (editingServiceDraft.name) payload.name = editingServiceDraft.name.trim();
      if (editingServiceDraft.category) payload.category = editingServiceDraft.category.trim();
      if (editingServiceDraft.base_price_display !== undefined) {
        payload.base_price = toCents(Number(editingServiceDraft.base_price_display));
      }
      if (editingServiceDraft.loyalty_eligible !== undefined) {
        payload.loyalty_eligible = editingServiceDraft.loyalty_eligible;
      }

      await api.put(`/inventory/services/${editingService}`, payload);
      setSuccess('Service updated');
      setEditingService(null);
      setEditingServiceDraft({});
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'services'] });
    } catch {
      setError('Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Extra Actions ---

  function addTier(isEditing: boolean) {
    if (isEditing) {
      setEditingExtraDraftTiers([...editingExtraDraftTiers, { name: '', price: '' }]);
    } else {
      setExtraFormTiers([...extraFormTiers, { name: '', price: '' }]);
    }
  }

  function removeTier(index: number, isEditing: boolean) {
    if (isEditing) {
      setEditingExtraDraftTiers(editingExtraDraftTiers.filter((_, i) => i !== index));
    } else {
      setExtraFormTiers(extraFormTiers.filter((_, i) => i !== index));
    }
  }

  function updateTier(index: number, field: 'name' | 'price', value: string, isEditing: boolean) {
    if (isEditing) {
      const newTiers = [...editingExtraDraftTiers];
      newTiers[index] = { ...newTiers[index], [field]: value };
      setEditingExtraDraftTiers(newTiers);
    } else {
      const newTiers = [...extraFormTiers];
      newTiers[index] = { ...newTiers[index], [field]: value };
      setExtraFormTiers(newTiers);
    }
  }

  async function createExtra(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const priceMap = tiersToPriceMap(extraFormTiers);
      if (Object.keys(priceMap).length === 0) {
        throw new Error('At least one valid price tier is required');
      }
      
      await api.post('/inventory/extras', {
        name: extraFormName.trim(),
        price_map: priceMap
      });
      
      setExtraFormName('');
      setExtraFormTiers([{ name: 'Standard', price: '' }]);
      setSuccess('Extra created successfully');
      setIsAddingExtra(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory', 'extras'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'services'] }),
      ]);
    } catch (err: any) {
      console.error('Create extra failed', err);
      setError(err.message || 'Could not create extra');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteExtra(id: number) {
    const extra = extras.find(x => x.id === id);
    if (!extra) return;
    setDeleteConfirm({ isOpen: true, type: 'extra', id, name: extra.name });
  }

  async function confirmDeleteExtra() {
    if (!deleteConfirm.isOpen || deleteConfirm.type !== 'extra') return;
    setSubmitting(true);
    try {
      await api.delete(`/inventory/extras/${deleteConfirm.id}`);
      setSuccess('Extra deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'extras'] });
    } catch {
      setError('Failed to delete extra');
    } finally { 
      setSubmitting(false); 
      setDeleteConfirm({ isOpen: false, type: 'service', id: 0, name: '' });
    }
  }

  function startEditExtra(x: ExtraItem) {
    setEditingExtra(x.id);
    setEditingExtraDraftName(x.name);
    setEditingExtraDraftTiers(priceMapToTiers(x.price_map));
  }

  async function saveEditExtra() {
    if (editingExtra == null) return;
    setSubmitting(true);
    setError(null);
    try {
      const priceMap = tiersToPriceMap(editingExtraDraftTiers);
      if (Object.keys(priceMap).length === 0) {
        throw new Error('At least one valid price tier is required');
      }

      await api.put(`/inventory/extras/${editingExtra}`, {
        name: editingExtraDraftName.trim(),
        price_map: priceMap
      });

      setSuccess('Extra updated');
      setEditingExtra(null);
      setEditingExtraDraftName('');
      setEditingExtraDraftTiers([]);
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'extras'] });
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Derived State ---

  const filteredServices = useMemo(() => services.filter(s => {
    if (!serviceFilter) return true;
    return (s.name + s.category).toLowerCase().includes(serviceFilter.toLowerCase());
  }), [services, serviceFilter]);

  const servicesByCategory = useMemo(() => {
    const map: Record<string, ServiceItem[]> = {};
    filteredServices.forEach(s => {
      map[s.category] = map[s.category] || [];
      map[s.category].push(s);
    });
    
    const sortFn = (a: ServiceItem, b: ServiceItem) => a.name.localeCompare(b.name);

    Object.values(map).forEach(arr => arr.sort(sortFn));
    let entries = Object.entries(map);
    entries = entries.sort((a,b)=> a[0].localeCompare(b[0]));
    return entries;
  }, [filteredServices]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(services.map(s => s.category))).sort();
  }, [services]);

  const filteredExtras = useMemo(() => {
    const list = extras.filter(x => !extraFilter || x.name.toLowerCase().includes(extraFilter.toLowerCase()));
    list.sort((a,b)=>a.name.localeCompare(b.name));
    return list;
  }, [extras, extraFilter]);

  // Auto dismiss success toast
  useEffect(()=> { 
    if (success) { 
      const t = setTimeout(()=>setSuccess(null), 3000); 
      return ()=>clearTimeout(t); 
    }
  }, [success]);

  function toggleCategory(cat: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  if (!canManageInventory) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">You don't have permission to manage inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 pb-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8'>
        
        {/* Header */}
        <div className='bg-white rounded-2xl p-8 shadow-sm border border-gray-100'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-6'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>Inventory Management</h1>
              <p className='text-gray-500 mt-1'>Manage your core services and extra add-ons</p>
            </div>
            <div className="flex items-center gap-4">
              {(submitting || loading) && (
                <div className='flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-full'>
                  <LoadingSpinner size="sm" color="blue" />
                  <span className='text-sm font-medium'>{submitting ? 'Saving...' : 'Loading...'}</span>
                </div>
              )}
              <button 
                onClick={refreshInventory}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh Data"
              >
                <Icons.Refresh />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          {displayError && (
            <div className='bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r shadow-sm flex items-start gap-3 animate-fade-in'>
              <Icons.AlertCircle />
              <div>
                <h3 className="font-bold">Error</h3>
                <p>{displayError}</p>
              </div>
            </div>
          )}
          {success && (
            <div className='bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-r shadow-sm flex items-start gap-3 animate-fade-in'>
              <Icons.CheckCircle />
              <div>
                <h3 className="font-bold">Success</h3>
                <p>{success}</p>
              </div>
            </div>
          )}
        </div>

        {/* CORE SERVICES SECTION */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Core Services</h2>
              <p className="text-sm text-gray-500">Primary offerings available to customers</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Icons.Search />
                </div>
                <input 
                  type="text"
                  placeholder="Filter services..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={serviceFilter}
                  onChange={e => setServiceFilter(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setIsAddingService(!isAddingService)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isAddingService 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                }`}
              >
                {isAddingService ? <><Icons.X /> Cancel</> : <><Icons.Plus /> Add Service</>}
              </button>
            </div>
          </div>

          {/* Add Service Form (Collapsible) */}
          {isAddingService && (
            <div className="p-6 border-b border-gray-100 bg-blue-50/30 animate-slide-down">
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide mb-4">New Service Details</h3>
              <form onSubmit={createService} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <input 
                    list="categories"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Wash Packages"
                    value={serviceForm.category}
                    onChange={e => setServiceForm({...serviceForm, category: e.target.value})}
                    required
                    autoFocus
                  />
                  <datalist id="categories">
                    {uniqueCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Service Name</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Premium Wash"
                    value={serviceForm.name}
                    onChange={e => setServiceForm({...serviceForm, name: e.target.value})}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Price (R)</label>
                  <input 
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    value={serviceForm.base_price}
                    onChange={e => setServiceForm({...serviceForm, base_price: e.target.value})}
                    required
                  />
                </div>
                <div className="md:col-span-2 flex items-center pb-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={serviceForm.loyalty_eligible}
                      onChange={e => setServiceForm({...serviceForm, loyalty_eligible: e.target.checked})}
                    />
                    <span className="text-sm text-gray-700">Loyalty Eligible</span>
                  </label>
                </div>
                <div className="md:col-span-1">
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50 flex justify-center"
                  >
                    {submitting ? <LoadingSpinner size="sm" color="white" /> : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Services List */}
          <div className="divide-y divide-gray-100">
            {servicesByCategory.map(([category, items]) => (
              <div key={category} className="bg-white">
                <button 
                  onClick={() => toggleCategory(category)}
                  className="w-full px-6 py-3 bg-gray-50/50 flex items-center justify-between hover:bg-gray-100 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 group-hover:text-gray-600 transition-colors">
                      {collapsedCategories.has(category) ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
                    </span>
                    <span className="font-bold text-gray-800">{category}</span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">{items.length}</span>
                  </div>
                </button>
                
                {!collapsedCategories.has(category) && (
                  <div className="divide-y divide-gray-100">
                    {items.map(service => (
                      <div key={service.id} className="p-4 pl-12 hover:bg-blue-50/10 transition-colors">
                        {editingService === service.id ? (
                          // Edit Mode
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                            <div className="md:col-span-3">
                              <label className="text-xs text-gray-500 block mb-1">Category</label>
                              <input 
                                list="categories"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                value={editingServiceDraft.category}
                                onChange={e => setEditingServiceDraft({...editingServiceDraft, category: e.target.value})}
                              />
                            </div>
                            <div className="md:col-span-4">
                              <label className="text-xs text-gray-500 block mb-1">Name</label>
                              <input 
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                value={editingServiceDraft.name}
                                onChange={e => setEditingServiceDraft({...editingServiceDraft, name: e.target.value})}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-xs text-gray-500 block mb-1">Price</label>
                              <input 
                                type="number"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                value={editingServiceDraft.base_price_display}
                                onChange={e => setEditingServiceDraft({...editingServiceDraft, base_price_display: e.target.value})}
                              />
                            </div>
                            <div className="md:col-span-1">
                              <label className="text-xs text-gray-500 block mb-1">Loyalty</label>
                              <input 
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                checked={editingServiceDraft.loyalty_eligible}
                                onChange={e => setEditingServiceDraft({...editingServiceDraft, loyalty_eligible: e.target.checked})}
                              />
                            </div>
                            <div className="md:col-span-2 flex gap-2 justify-end">
                              <button onClick={saveEditService} className="p-2 bg-green-600 text-white rounded hover:bg-green-700" title="Save">
                                <Icons.Check />
                              </button>
                              <button onClick={() => setEditingService(null)} className="p-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400" title="Cancel">
                                <Icons.X />
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div>
                                <h4 className="font-medium text-gray-900">{service.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-green-600 font-bold">{formatCurrency(service.base_price)}</span>
                                  {service.loyalty_eligible && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Loyalty Eligible</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => startEditService(service)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Icons.Edit />
                              </button>
                              <button 
                                onClick={() => deleteService(service.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Icons.Trash />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {servicesByCategory.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <Icons.Search />
                </div>
                <p className="text-lg font-medium text-gray-900">No services found</p>
                <p className="text-sm text-gray-500 mt-1">Try adjusting your search or add a new service.</p>
                <button 
                  onClick={() => setIsAddingService(true)}
                  className="mt-4 text-blue-600 font-medium hover:text-blue-700"
                >
                  Add your first service
                </button>
              </div>
            )}
          </div>
        </section>

        {/* EXTRAS SECTION */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Extras & Add-ons</h2>
              <p className="text-sm text-gray-500">Optional extras with tiered pricing</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Icons.Search />
                </div>
                <input 
                  type="text"
                  placeholder="Filter extras..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  value={extraFilter}
                  onChange={e => setExtraFilter(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setIsAddingExtra(!isAddingExtra)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isAddingExtra 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
                }`}
              >
                {isAddingExtra ? <><Icons.X /> Cancel</> : <><Icons.Plus /> Add Extra</>}
              </button>
            </div>
          </div>

          {/* Add Extra Form (Collapsible) */}
          {isAddingExtra && (
            <div className="p-6 border-b border-gray-100 bg-purple-50/30 animate-slide-down">
              <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wide mb-4">New Extra Details</h3>
              <form onSubmit={createExtra} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Extra Name</label>
                  <input 
                    className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g. Air Freshener"
                    value={extraFormName}
                    onChange={e => setExtraFormName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Pricing Tiers</label>
                  <div className="space-y-2">
                    {extraFormTiers.map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-3 animate-fade-in">
                        <input 
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                          placeholder="Tier Name (e.g. Standard)"
                          value={tier.name}
                          onChange={e => updateTier(idx, 'name', e.target.value, false)}
                          required
                        />
                        <div className="relative w-32">
                          <span className="absolute left-3 top-2 text-gray-500 text-sm">R</span>
                          <input 
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                            placeholder="0.00"
                            value={tier.price}
                            onChange={e => updateTier(idx, 'price', e.target.value, false)}
                            required
                          />
                        </div>
                        {extraFormTiers.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeTier(idx, false)}
                            className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                            title="Remove Tier"
                          >
                            <Icons.Trash />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button 
                    type="button"
                    onClick={() => addTier(false)}
                    className="mt-3 text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <Icons.Plus /> Add another tier
                  </button>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? <LoadingSpinner size="sm" color="white" /> : 'Create Extra'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Extras List */}
          <div className="divide-y divide-gray-100">
            {filteredExtras.map(extra => (
              <div key={extra.id} className="p-6 hover:bg-purple-50/10 transition-colors group">
                {editingExtra === extra.id ? (
                  // Edit Mode
                  <div className="space-y-4 bg-purple-50 p-4 rounded-lg border border-purple-100 shadow-sm">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                      <input 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        value={editingExtraDraftName}
                        onChange={e => setEditingExtraDraftName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">Pricing Tiers</label>
                      <div className="space-y-2">
                        {editingExtraDraftTiers.map((tier, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <input 
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                              value={tier.name}
                              onChange={e => updateTier(idx, 'name', e.target.value, true)}
                            />
                            <div className="relative w-32">
                              <span className="absolute left-3 top-2 text-gray-500 text-sm">R</span>
                              <input 
                                type="number"
                                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                                value={tier.price}
                                onChange={e => updateTier(idx, 'price', e.target.value, true)}
                              />
                            </div>
                            <button 
                              type="button" 
                              onClick={() => removeTier(idx, true)}
                              className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50"
                            >
                              <Icons.Trash />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button 
                        type="button"
                        onClick={() => addTier(true)}
                        className="mt-2 text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center gap-1"
                      >
                        <Icons.Plus /> Add tier
                      </button>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={saveEditExtra} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2">
                        <Icons.Check /> Save Changes
                      </button>
                      <button onClick={() => setEditingExtra(null)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium flex items-center gap-2">
                        <Icons.X /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">{extra.name}</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(extra.price_map).map(([tier, price]) => (
                          <div key={tier} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium border border-purple-200">
                            <span className="opacity-75 mr-1">{tier}:</span>
                            <span className="font-bold">{formatCurrency(Number(price))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEditExtra(extra)}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Icons.Edit />
                      </button>
                      <button 
                        onClick={() => deleteExtra(extra.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredExtras.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <Icons.Search />
                </div>
                <p className="text-lg font-medium text-gray-900">No extras found</p>
                <p className="text-sm text-gray-500 mt-1">Add optional extras to upsell your services.</p>
                <button 
                  onClick={() => setIsAddingExtra(true)}
                  className="mt-4 text-purple-600 font-medium hover:text-purple-700"
                >
                  Add your first extra
                </button>
              </div>
            )}
          </div>
        </section>

        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title={`Delete ${deleteConfirm.type === 'service' ? 'Service' : 'Extra'}`}
          description={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loading={submitting}
          onConfirm={deleteConfirm.type === 'service' ? confirmDeleteService : confirmDeleteExtra}
          onCancel={() => setDeleteConfirm({ isOpen: false, type: 'service', id: 0, name: '' })}
        />
      </div>
    </div>
  );
};

export default InventoryPage;
