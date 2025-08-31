import { useEffect, useState } from 'react';
import { VerticalType } from '../config/verticalTypes';

interface TenantRow {
  id: string;
  name: string;
  vertical_type: VerticalType;
  primary_domain?: string;
  config?: object;
}

export default function TenantList() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/tenants', { credentials: 'include' })
      .then(r => r.json())
      .then(setTenants)
      .catch(e => setError(e.message || 'Failed to load tenants'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading tenants…</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h3>Tenants</h3>
      <table className="dev-admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Vertical</th>
            <th>Domain</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map(t => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.vertical_type}</td>
              <td>{t.primary_domain}</td>
              <td>
                {/* TODO: Add edit/invite actions */}
                <button disabled>Edit</button>
                <button disabled>Invite Admin</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
