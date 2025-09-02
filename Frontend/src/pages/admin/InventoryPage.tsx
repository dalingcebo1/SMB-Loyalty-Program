import React, { useEffect, useState } from 'react';

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
  const [form, setForm] = useState({ category: '', name: '', base_price: 0, loyalty_eligible: false });
  const [extraForm, setExtraForm] = useState({ name: '', price_map: '{}' });
  const [error, setError] = useState<string | null>(null);

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
    try {
      await fetch('/api/inventory/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setForm({ category: '', name: '', base_price: 0, loyalty_eligible: false });
      fetchAll();
    } catch (err) {
      console.error('Create service failed', err);
    }
  }

  async function deleteService(id: number) {
    if (!confirm('Delete service?')) return;
    await fetch(`/api/inventory/services/${id}`, { method: 'DELETE' });
    fetchAll();
  }

  async function createExtra(e: React.FormEvent) {
    e.preventDefault();
    try {
      let map: Record<string, number> = {};
      try { map = JSON.parse(extraForm.price_map); } catch { alert('Invalid JSON for price_map'); return; }
      await fetch('/api/inventory/extras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: extraForm.name, price_map: map }) });
      setExtraForm({ name: '', price_map: '{}' });
      fetchAll();
    } catch (err) {
      console.error('Create extra failed', err);
    }
  }

  async function deleteExtra(id: number) {
    if (!confirm('Delete extra?')) return;
    await fetch(`/api/inventory/extras/${id}`, { method: 'DELETE' });
    fetchAll();
  }

  return (
    <div className='p-4 space-y-8'>
      <h1 className='text-xl font-semibold'>Inventory Management</h1>
      {error && <div className='text-red-600'>{error}</div>}
      {loading && <div>Loading…</div>}

      <section>
        <h2 className='font-medium mb-2'>Services</h2>
        <form onSubmit={createService} className='flex gap-2 flex-wrap items-end mb-4'>
          <input className='border px-2 py-1' placeholder='Category' value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))} required />
          <input className='border px-2 py-1' placeholder='Name' value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} required />
          <input className='border px-2 py-1 w-28' type='number' placeholder='Base Price' value={form.base_price} onChange={e=>setForm(f=>({...f, base_price:Number(e.target.value)}))} required />
            <label className='inline-flex items-center gap-1 text-sm'>
              <input type='checkbox' checked={form.loyalty_eligible} onChange={e=>setForm(f=>({...f, loyalty_eligible:e.target.checked}))} /> Loyalty
            </label>
          <button className='bg-blue-600 text-white px-3 py-1 rounded'>Add</button>
        </form>
        <div className='space-y-2'>
          {services.map(s => (
            <div key={s.id} className='flex justify-between border rounded px-2 py-1 text-sm items-center'>
              <div className='flex flex-col'>
                <span className='font-medium'>{s.name}</span>
                <span className='text-xs text-gray-500'>{s.category} · {s.base_price} · {s.loyalty_eligible ? 'Loyalty' : '—'}</span>
              </div>
              <button onClick={()=>deleteService(s.id)} className='text-red-600 hover:underline'>Delete</button>
            </div>
          ))}
          {services.length===0 && <div className='text-xs text-gray-500'>No services yet.</div>}
        </div>
      </section>

      <section>
        <h2 className='font-medium mb-2'>Extras</h2>
        <form onSubmit={createExtra} className='flex gap-2 flex-wrap items-end mb-4'>
          <input className='border px-2 py-1' placeholder='Name' value={extraForm.name} onChange={e=>setExtraForm(f=>({...f, name:e.target.value}))} required />
          <textarea className='border px-2 py-1 w-64 h-20 text-xs font-mono' placeholder='{"tier":"price"}' value={extraForm.price_map} onChange={e=>setExtraForm(f=>({...f, price_map:e.target.value}))} />
          <button className='bg-blue-600 text-white px-3 py-1 rounded'>Add</button>
        </form>
        <div className='space-y-2'>
          {extras.map(x => (
            <div key={x.id} className='flex justify-between border rounded px-2 py-1 text-sm items-center'>
              <div className='flex flex-col'>
                <span className='font-medium'>{x.name}</span>
                <span className='text-xs text-gray-500 truncate max-w-xs'>{JSON.stringify(x.price_map)}</span>
              </div>
              <button onClick={()=>deleteExtra(x.id)} className='text-red-600 hover:underline'>Delete</button>
            </div>
          ))}
          {extras.length===0 && <div className='text-xs text-gray-500'>No extras yet.</div>}
        </div>
      </section>
    </div>
  );
};

export default InventoryPage;
