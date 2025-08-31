import React, { useState } from 'react';
import { VerticalType } from '../config/verticalTypes';

const verticals: VerticalType[] = ['carwash', 'dispensary', 'padel', 'flowershop', 'beauty'];

export default function CreateTenant() {
  const [form, setForm] = useState({
    name: '',
    vertical_type: 'carwash',
    primary_domain: '',
    branding: '',
    config: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.name.toLowerCase().replace(/\s+/g, '-'),
          name: form.name,
          vertical_type: form.vertical_type,
          primary_domain: form.primary_domain,
          config: form.config ? JSON.parse(form.config) : {},
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Tenant created!');
      setForm({ name: '', vertical_type: 'carwash', primary_domain: '', branding: '', config: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="dev-admin-form" onSubmit={handleSubmit}>
      <h3>Create Tenant</h3>
      <label>
        Name
        <input name="name" value={form.name} onChange={handleChange} required />
      </label>
      <label>
        Vertical
        <select name="vertical_type" value={form.vertical_type} onChange={handleChange}>
          {verticals.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>
        Primary Domain
        <input name="primary_domain" value={form.primary_domain} onChange={handleChange} />
      </label>
      <label>
        Config (JSON)
        <input name="config" value={form.config} onChange={handleChange} placeholder="{ &quot;features&quot;: {}}" />
      </label>
      <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Tenant'}</button>
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}
    </form>
  );
}
