import React, { useEffect, useMemo, useState } from 'react';

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

const InventoryPage: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category: '', name: '', base_price: 0, loyalty_eligible: false });
  const [extraForm, setExtraForm] = useState({ name: '', price_map: '{}' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState('');
  const [extraFilter, setExtraFilter] = useState('');
  const [editingService, setEditingService] = useState<number | null>(null);
  const [editingServiceDraft, setEditingServiceDraft] = useState<Partial<ServiceItem>>({});
  const [editingExtra, setEditingExtra] = useState<number | null>(null);
  const [editingExtraDraft, setEditingExtraDraft] = useState<Partial<ExtraItem>>({});
  // UI enhancement states
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [serviceSort, setServiceSort] = useState<'name' | 'price' | 'category'>('category');
  const [extraSort, setExtraSort] = useState<'name'>('name');
  const [priceMapError, setPriceMapError] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true); setError(null);
    try {
      const svc = await fetch('/api/inventory/services');
      const svcData = await svc.json();
      setServices(svcData.services || []);
      const ex = await fetch('/api/inventory/extras');
      const exData = await ex.json();
      setExtras(exData.extras || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
  if (form.base_price < 0) throw new Error('Price must be >= 0');
      const r = await fetch('/api/inventory/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error('Create failed');
      setForm({ category: '', name: '', base_price: 0, loyalty_eligible: false });
      setSuccess('Service created');
      fetchAll();
    } catch (err) {
      console.error('Create service failed', err);
      setError('Could not create service');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteService(id: number) {
    if (!confirm('Delete service?')) return;
    setSubmitting(true);
    try {
      await fetch(`/api/inventory/services/${id}`, { method: 'DELETE' });
      setSuccess('Service deleted');
      fetchAll();
    } finally { setSubmitting(false); }
  }

  function startEditService(s: ServiceItem) {
    setEditingService(s.id);
    setEditingServiceDraft({ ...s });
  }
  function cancelEditService() { setEditingService(null); setEditingServiceDraft({}); }
  async function saveEditService() {
    if (editingService == null) return;
    setSubmitting(true); setError(null);
    try {
      type ServiceUpdatePayload = Partial<Pick<ServiceItem, 'name' | 'category' | 'base_price' | 'loyalty_eligible'>>;
      const payload: ServiceUpdatePayload = {};
  if (editingServiceDraft.name !== undefined) payload.name = editingServiceDraft.name;
  if (editingServiceDraft.category !== undefined) payload.category = editingServiceDraft.category;
  if (editingServiceDraft.base_price !== undefined) payload.base_price = Number(editingServiceDraft.base_price);
  if (editingServiceDraft.loyalty_eligible !== undefined) payload.loyalty_eligible = Boolean(editingServiceDraft.loyalty_eligible);
      const r = await fetch(`/api/inventory/services/${editingService}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Update failed');
      setSuccess('Service updated');
      setEditingService(null); setEditingServiceDraft({});
      fetchAll();
    } catch {
      setError('Update failed');
    } finally { setSubmitting(false); }
  }

  async function createExtra(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      let map: Record<string, number> = {};
  try { map = JSON.parse(extraForm.price_map); setPriceMapError(null); } catch { setPriceMapError('Invalid JSON'); throw new Error('Invalid JSON'); }
      const r = await fetch('/api/inventory/extras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: extraForm.name, price_map: map }) });
      if (!r.ok) throw new Error('Create failed');
      setExtraForm({ name: '', price_map: '{}' });
      setSuccess('Extra created');
      fetchAll();
    } catch (err) {
      console.error('Create extra failed', err);
      setError('Could not create extra');
    } finally { setSubmitting(false); }
  }

  async function deleteExtra(id: number) {
    if (!confirm('Delete extra?')) return;
    setSubmitting(true);
    try {
      await fetch(`/api/inventory/extras/${id}`, { method: 'DELETE' });
      setSuccess('Extra deleted');
      fetchAll();
    } finally { setSubmitting(false); }
  }

  function startEditExtra(x: ExtraItem) {
    setEditingExtra(x.id);
    setEditingExtraDraft({ ...x, price_map: x.price_map });
  }
  function cancelEditExtra() { setEditingExtra(null); setEditingExtraDraft({}); }
  async function saveEditExtra() {
    if (editingExtra == null) return;
    setSubmitting(true); setError(null);
    try {
      type ExtraUpdatePayload = { name?: string; price_map?: Record<string, number> };
      const payload: ExtraUpdatePayload = {};
      if (editingExtraDraft.name !== undefined) payload.name = editingExtraDraft.name as string;
      if (editingExtraDraft.price_map !== undefined) payload.price_map = editingExtraDraft.price_map as Record<string, number>;
      const r = await fetch(`/api/inventory/extras/${editingExtra}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Update failed');
      setSuccess('Extra updated');
      setEditingExtra(null); setEditingExtraDraft({});
      fetchAll();
    } catch { setError('Update failed'); }
    finally { setSubmitting(false); }
  }

  // Derived filtered lists
  const filteredServices = useMemo(() => services.filter(s => {
    if (!serviceFilter) return true; return (s.name + s.category).toLowerCase().includes(serviceFilter.toLowerCase());
  }), [services, serviceFilter]);
  const servicesByCategory = useMemo(() => {
    const map: Record<string, ServiceItem[]> = {};
    filteredServices.forEach(s => { map[s.category] = map[s.category] || []; map[s.category].push(s); });
    // sort services within each category
    const sortFn = (a: ServiceItem, b: ServiceItem) => {
      switch (serviceSort) {
        case 'name': return a.name.localeCompare(b.name);
        case 'price': return a.base_price - b.base_price;
        case 'category': default: return a.name.localeCompare(b.name);
      }
    };
    Object.values(map).forEach(arr => arr.sort(sortFn));
    let entries = Object.entries(map);
    if (serviceSort === 'category') entries = entries.sort((a,b)=> a[0].localeCompare(b[0]));
    return entries;
  }, [filteredServices, serviceSort]);
  const filteredExtras = useMemo(() => {
    const list = extras.filter(x => !extraFilter || x.name.toLowerCase().includes(extraFilter.toLowerCase()));
    if (extraSort === 'name') list.sort((a,b)=>a.name.localeCompare(b.name));
    return list;
  }, [extras, extraFilter, extraSort]);

  const currency = useMemo(()=> new Intl.NumberFormat(undefined,{ style:'currency', currency:'USD'}), []);

  // Auto dismiss success toast
  useEffect(()=> { if (success) { const t = setTimeout(()=>setSuccess(null), 3000); return ()=>clearTimeout(t); }}, [success]);

  function toggleCategory(cat: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 to-gray-100'>
      <div className='max-w-7xl mx-auto px-6 py-8 space-y-8'>
        {/* Enhanced Header */}
        <div className='relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-800 text-white rounded-2xl p-8 shadow-xl'>
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
          <div className="relative z-10">
            <div className='flex items-center justify-between'>
              <div>
                <h1 className='text-4xl font-bold mb-3'>Inventory Management</h1>
                <p className='text-teal-100 text-lg'>Manage your services and extras inventory</p>
              </div>
              <div className="hidden md:flex items-center space-x-4">
                {submitting && <span className='text-sm text-teal-200 animate-pulse'>Working…</span>}
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {error && <div className='bg-red-50 border-l-4 border-red-400 text-red-700 px-6 py-4 rounded-lg shadow-sm'>{error}</div>}
        {success && <div className='bg-green-50 border-l-4 border-green-400 text-green-700 px-6 py-4 rounded-lg shadow-sm'>{success}</div>}
        {loading && <div className='bg-blue-50 border-l-4 border-blue-400 text-blue-700 px-6 py-4 rounded-lg shadow-sm'>Loading inventory data…</div>}

        {/* Services Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className='bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-100'>
            <div className='flex flex-wrap items-center gap-4 justify-between'>
              <div>
                <h2 className='text-2xl font-bold text-gray-800 mb-1'>Services</h2>
                <p className='text-gray-600'>Manage your service offerings</p>
              </div>
              <div className='flex flex-wrap items-center gap-4'>
                <span className='text-sm text-gray-500 bg-white px-3 py-1 rounded-full border'>
                  {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'}
                </span>
                <input 
                  className='border border-gray-300 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors' 
                  placeholder='Filter services…' 
                  value={serviceFilter} 
                  onChange={e=>setServiceFilter(e.target.value)} 
                />
                <select 
                  className='border border-gray-300 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors' 
                  value={serviceSort} 
                  onChange={e=>setServiceSort(e.target.value as 'name' | 'price' | 'category')}
                >
                  <option value='category'>Sort by Category</option>
                  <option value='name'>Sort by Name</option>
                  <option value='price'>Sort by Price</option>
                </select>
                <button 
                  type='button' 
                  onClick={()=>fetchAll()} 
                  className='text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Service Creation Form */}
          <div className='p-6 bg-gray-50 border-b border-gray-100'>
            <h3 className='font-semibold text-gray-800 mb-4'>Add New Service</h3>
            <form onSubmit={createService} className='flex gap-3 flex-wrap items-end'>
              <div className='flex-1 min-w-[120px]'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Category</label>
                <input 
                  className='w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors' 
                  placeholder='e.g., Wash Packages' 
                  value={form.category} 
                  onChange={e=>setForm(f=>({...f, category:e.target.value}))} 
                  required 
                />
              </div>
              <div className='flex-1 min-w-[120px]'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Service Name</label>
                <input 
                  className='w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors' 
                  placeholder='e.g., Premium Wash' 
                  value={form.name} 
                  onChange={e=>setForm(f=>({...f, name:e.target.value}))} 
                  required 
                />
              </div>
              <div className='min-w-[100px]'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Base Price</label>
                <input 
                  className='w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors' 
                  min={0} 
                  type='number' 
                  placeholder='0.00' 
                  value={form.base_price} 
                  onChange={e=>setForm(f=>({...f, base_price:Number(e.target.value)}))} 
                  required 
                />
              </div>
              <div className='flex items-center pb-2'>
                <label className='inline-flex items-center gap-2 text-sm font-medium text-gray-700'>
                  <input 
                    type='checkbox' 
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500' 
                    checked={form.loyalty_eligible} 
                    onChange={e=>setForm(f=>({...f, loyalty_eligible:e.target.checked}))} 
                  /> 
                  Loyalty Eligible
                </label>
              </div>
              <button 
                disabled={submitting} 
                className='px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-50 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-sm'
              >
                Add Service
              </button>
            </form>
          </div>

          {/* Services List */}
          <div className='p-6 space-y-4'>
            {servicesByCategory.map(([cat, list]) => (
              <div key={cat} className='border border-gray-200 rounded-xl overflow-hidden'>
                <button 
                  type='button' 
                  onClick={()=>toggleCategory(cat)} 
                  className='flex justify-between items-center w-full text-left p-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200'
                >
                  <span className='font-semibold text-gray-800 uppercase tracking-wide'>{cat}</span>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs text-gray-500 bg-white px-2 py-1 rounded-full border'>{list.length}</span>
                    <span className='text-gray-400 transition-transform duration-200'>{collapsedCategories.has(cat)?'▶':'▼'}</span>
                  </div>
                </button>
                {!collapsedCategories.has(cat) && (
                <div className='divide-y divide-gray-100'>
                  {list.map(s => (
                    <div key={s.id} className='p-4 hover:bg-gray-50 transition-colors'>
                      {editingService === s.id ? (
                        <div className='space-y-3'>
                          <div className='grid grid-cols-1 md:grid-cols-4 gap-3'>
                            <input 
                              className='border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                              placeholder='Service name'
                              value={editingServiceDraft.name as string || ''} 
                              onChange={e=>setEditingServiceDraft(d=>({...d, name:e.target.value}))} 
                            />
                            <input 
                              className='border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                              type='number' 
                              placeholder='Price'
                              value={editingServiceDraft.base_price as number || 0} 
                              onChange={e=>setEditingServiceDraft(d=>({...d, base_price:Number(e.target.value)}))} 
                            />
                            <input 
                              className='border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                              placeholder='Category'
                              value={editingServiceDraft.category as string || ''} 
                              onChange={e=>setEditingServiceDraft(d=>({...d, category:e.target.value}))} 
                            />
                            <label className='inline-flex items-center justify-center gap-2 text-sm'>
                              <input 
                                type='checkbox' 
                                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                                checked={!!editingServiceDraft.loyalty_eligible} 
                                onChange={e=>setEditingServiceDraft(d=>({...d, loyalty_eligible:e.target.checked}))} 
                              /> 
                              Loyalty
                            </label>
                          </div>
                          <div className='flex gap-2'>
                            <button 
                              type='button' 
                              onClick={saveEditService} 
                              className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium'
                            >
                              Save Changes
                            </button>
                            <button 
                              type='button' 
                              onClick={cancelEditService} 
                              className='px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors'
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className='flex justify-between items-start'>
                          <div className='flex-1'>
                            <h4 className='font-semibold text-gray-900 text-lg'>{s.name}</h4>
                            <div className='flex items-center gap-4 mt-1'>
                              <span className='text-green-600 font-bold text-lg'>{currency.format(s.base_price)}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                s.loyalty_eligible 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {s.loyalty_eligible ? 'Loyalty Eligible' : 'Standard'}
                              </span>
                            </div>
                          </div>
                          <div className='flex gap-2'>
                            <button 
                              onClick={()=>startEditService(s)} 
                              className='px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium'
                            >
                              Edit
                            </button>
                            <button 
                              onClick={()=>deleteService(s.id)} 
                              className='px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium'
                            >
                              Delete
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
            {filteredServices.length===0 && (
              <div className='text-center py-12 text-gray-500'>
                <div className='text-4xl mb-3'>📋</div>
                <div className='text-lg font-medium mb-1'>No services found</div>
                <div className='text-sm'>Add a service or adjust your filters</div>
              </div>
            )}
          </div>
        </section>

        {/* Extras Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className='bg-gradient-to-r from-purple-50 to-pink-50 p-6 border-b border-gray-100'>
            <div className='flex flex-wrap items-center gap-4 justify-between'>
              <div>
                <h2 className='text-2xl font-bold text-gray-800 mb-1'>Extras</h2>
                <p className='text-gray-600'>Manage additional service options</p>
              </div>
              <div className='flex flex-wrap items-center gap-4'>
                <span className='text-sm text-gray-500 bg-white px-3 py-1 rounded-full border'>
                  {filteredExtras.length} {filteredExtras.length === 1 ? 'extra' : 'extras'}
                </span>
                <input 
                  className='border border-gray-300 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors' 
                  placeholder='Filter extras…' 
                  value={extraFilter} 
                  onChange={e=>setExtraFilter(e.target.value)} 
                />
                <select 
                  className='border border-gray-300 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors' 
                  value={extraSort} 
                  onChange={e=>setExtraSort(e.target.value as 'name')}
                >
                  <option value='name'>Sort by Name</option>
                </select>
                <button 
                  type='button' 
                  onClick={()=>fetchAll()} 
                  className='text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Extra Creation Form */}
          <div className='p-6 bg-gray-50 border-b border-gray-100'>
            <h3 className='font-semibold text-gray-800 mb-4'>Add New Extra</h3>
            <form onSubmit={createExtra} className='space-y-4'>
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Extra Name</label>
                  <input 
                    className='w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors' 
                    placeholder='e.g., Air Freshener, Wax Protection' 
                    value={extraForm.name} 
                    onChange={e=>setExtraForm(f=>({...f, name:e.target.value}))} 
                    required 
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Price Mapping (JSON)
                    {priceMapError && <span className='text-red-600 text-xs ml-2'>- {priceMapError}</span>}
                  </label>
                  <textarea 
                    className={`w-full border px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:border-purple-500 transition-colors h-20 ${
                      priceMapError ? 'border-red-500 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'
                    }`} 
                    placeholder='{"basic": 5.00, "premium": 8.00, "deluxe": 12.00}' 
                    value={extraForm.price_map} 
                    onChange={e=>{
                      const val = e.target.value; 
                      setExtraForm(f=>({...f, price_map:val}));
                      try { 
                        JSON.parse(val); 
                        setPriceMapError(null); 
                      } catch { 
                        setPriceMapError('Invalid JSON format'); 
                      }
                    }} 
                  />
                  <div className='text-xs text-gray-500 mt-1'>
                    Define prices for different service tiers. Example: {"{"}"basic": 5.00, "premium": 8.00{"}"}
                  </div>
                </div>
              </div>
              <div className='flex gap-3'>
                <button 
                  disabled={submitting || !!priceMapError} 
                  className='px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-medium shadow-sm disabled:cursor-not-allowed'
                >
                  Add Extra
                </button>
                {priceMapError && (
                  <div className='flex items-center text-red-600 text-sm'>
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Please fix JSON format
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Extras List */}
          <div className='p-6 space-y-4'>
            {filteredExtras.map(x => (
              <div key={x.id} className='border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors'>
                {editingExtra === x.id ? (
                  <div className='space-y-4'>
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>Extra Name</label>
                        <input 
                          className='w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                          value={editingExtraDraft.name as string || ''} 
                          onChange={e=>setEditingExtraDraft(d=>({...d, name:e.target.value}))} 
                        />
                      </div>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>Price Mapping (JSON)</label>
                        <textarea 
                          className='w-full border border-gray-300 px-3 py-2 rounded-lg font-mono text-sm h-24 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                          value={JSON.stringify(editingExtraDraft.price_map, null, 2)} 
                          onChange={e=>{
                            try { 
                              setEditingExtraDraft(d=>({...d, price_map: JSON.parse(e.target.value)})); 
                            } catch { 
                              // Ignore parse errors while editing
                            }
                          }} 
                        />
                      </div>
                    </div>
                    <div className='flex gap-2'>
                      <button 
                        type='button' 
                        onClick={saveEditExtra} 
                        className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium'
                      >
                        Save Changes
                      </button>
                      <button 
                        type='button' 
                        onClick={cancelEditExtra} 
                        className='px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors'
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className='flex justify-between items-start'>
                    <div className='flex-1'>
                      <h4 className='font-semibold text-gray-900 text-lg mb-2'>{x.name}</h4>
                      <div className='space-y-1'>
                        <div className='text-sm font-medium text-gray-700'>Pricing by Tier:</div>
                        <div className='flex flex-wrap gap-2'>
                          {Object.entries(x.price_map).map(([tier, price]) => (
                            <span 
                              key={tier} 
                              className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800'
                            >
                              {tier}: {currency.format(Number(price))}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className='flex gap-2 ml-4'>
                      <button 
                        onClick={()=>startEditExtra(x)} 
                        className='px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-sm font-medium'
                      >
                        Edit
                      </button>
                      <button 
                        onClick={()=>deleteExtra(x.id)} 
                        className='px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium'
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredExtras.length===0 && (
              <div className='text-center py-12 text-gray-500'>
                <div className='text-4xl mb-3'>🎯</div>
                <div className='text-lg font-medium mb-1'>No extras found</div>
                <div className='text-sm'>Add an extra or adjust your filters</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default InventoryPage;
