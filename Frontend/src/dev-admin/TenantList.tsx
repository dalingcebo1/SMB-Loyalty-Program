import { useState } from 'react';
import { VerticalType } from '../config/verticalTypes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface TenantRow {
  id: string;
  name: string;
  vertical_type: VerticalType;
  primary_domain?: string;
  config?: object;
}

function useTenants() {
  return useQuery<TenantRow[]>({
    queryKey: ['tenants'],
    queryFn: async () => {
      const r = await fetch('/api/tenants', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed loading tenants');
      return r.json();
    },
    staleTime: 30_000,
  });
}

interface EditState {
  open: boolean;
  tenant?: TenantRow;
}

interface InviteState {
  open: boolean;
  tenant?: TenantRow;
}

export default function TenantList() {
  const qc = useQueryClient();
  const { data: tenants, isLoading, error } = useTenants();
  const [edit, setEdit] = useState<EditState>({ open: false });
  const [invite, setInvite] = useState<InviteState>({ open: false });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  interface UpdatePayload { id: string; patch: Partial<TenantRow> & { config?: Record<string, unknown> } }
  const updateMutation = useMutation({
    mutationFn: async (payload: UpdatePayload) => {
      const r = await fetch(`/api/tenants/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.patch),
        credentials: 'include'
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setEdit({ open: false }); },
    onError: (e: unknown) => { setUpdateError(e instanceof Error ? e.message : 'Update failed'); }
  });

  const handleSave = () => {
    if (!edit.tenant) return;
    // collect fields
    const nameEl = document.getElementById('tenant-edit-name') as HTMLInputElement;
    const domainEl = document.getElementById('tenant-edit-domain') as HTMLInputElement;
    const verticalEl = document.getElementById('tenant-edit-vertical') as HTMLSelectElement;
    const configRawEl = document.getElementById('tenant-config-json') as HTMLTextAreaElement;
    let parsedConfig: Record<string, unknown> = {};
    try { parsedConfig = configRawEl.value ? JSON.parse(configRawEl.value) : {}; } catch { setUpdateError('Invalid JSON in config'); return; }
    // feature toggles
    const features: Record<string, boolean> = {};
    document.querySelectorAll<HTMLInputElement>('input[data-feature-toggle]')
      .forEach(cb => { features[cb.getAttribute('data-feature-toggle') || ''] = cb.checked; });
    parsedConfig.features = { ...(parsedConfig.features as object || {}), ...features };
    updateMutation.mutate({ id: edit.tenant.id, patch: {
      name: nameEl.value,
      primary_domain: domainEl.value || undefined,
      vertical_type: verticalEl.value as VerticalType,
      config: parsedConfig,
    }});
  };

  const handleInvite = async () => {
    if (!invite.tenant) return;
    setInviteLoading(true); setInviteResult(null);
    try {
      const r = await fetch(`/api/tenants/${invite.tenant.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
        credentials: 'include'
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setInviteResult(`Invite created. Token: ${data.token}`);
      setInviteEmail('');
    } catch (e) {
      setInviteResult(`Error: ${e instanceof Error ? e.message : 'Invite failed'}`);
    } finally {
      setInviteLoading(false);
    }
  };

  if (isLoading) return <div>Loading tenants…</div>;
  if (error) return <div style={{ color: 'red' }}>{(error as Error).message}</div>;
  if (!tenants) return null;

  return (
    <div>
      <h3>Tenants</h3>
      <p style={{color:'#666', marginTop:0}}>Manage tenants across verticals. Edit config or invite admins.</p>
      <table className="dev-admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Vertical</th>
            <th>Domain</th>
            <th>Features</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map(t => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.vertical_type}</td>
              <td>{t.primary_domain}</td>
              <td style={{maxWidth:200}}>
                {(t.config && typeof t.config === 'object' && (t.config as { features?: Record<string, unknown> }).features
                  ? Object.entries((t.config as { features?: Record<string, unknown> }).features as Record<string, unknown>)
                  : [])
                  .filter(([, v]) => Boolean(v))
                  .slice(0,4)
                  .map(([k]) => <span key={k} style={{background:'#eef', padding:'2px 6px', borderRadius:4, marginRight:4, fontSize:12}}>{k}</span>)}
              </td>
              <td style={{whiteSpace:'nowrap'}}>
                <button onClick={() => setEdit({ open: true, tenant: t })} style={{marginRight:6}}>Edit</button>
                <button onClick={() => setInvite({ open: true, tenant: t })}>Invite</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit.open && edit.tenant && (
        <div style={modalStyle}>
          <div style={panelStyle}>
            <h4 style={{marginTop:0}}>Edit Tenant – {edit.tenant.id}</h4>
            <label style={editLabelStyle}>Name <input id="tenant-edit-name" defaultValue={edit.tenant.name} style={inputStyle} /></label>
            <label style={editLabelStyle}>Primary Domain <input id="tenant-edit-domain" defaultValue={edit.tenant.primary_domain || ''} style={inputStyle} /></label>
            <label style={editLabelStyle}>Vertical
              <select id="tenant-edit-vertical" defaultValue={edit.tenant.vertical_type} style={inputStyle}>
                {['carwash','dispensary','padel','flowershop','beauty'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <fieldset style={{border:'1px solid #ddd', padding:8, borderRadius:6}}>
              <legend style={{fontSize:12, padding:'0 4px'}}>Features</legend>
              {['enableLoyalty','enableOrders','enablePayments','enableUsers'].map(fk => {
                const features = (edit.tenant!.config && typeof edit.tenant!.config === 'object'
                  ? (edit.tenant!.config as { features?: Record<string, unknown> }).features
                  : undefined) || {};
                const enabled = Boolean(features[fk]);
                return <label key={fk} style={{display:'inline-flex', alignItems:'center', marginRight:12, fontSize:12}}>
                  <input type="checkbox" defaultChecked={enabled} data-feature-toggle={fk} style={{marginRight:4}} /> {fk}
                </label>;
              })}
            </fieldset>
            <div style={{marginTop:8, fontSize:12}}>Advanced JSON Config</div>
            <textarea id="tenant-config-json" defaultValue={JSON.stringify(edit.tenant.config || {}, null, 2)} style={{width:'100%', height:160, fontFamily:'monospace', fontSize:12}} />
            {updateError && <div style={{color:'red', marginTop:8}}>{updateError}</div>}
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
              <button onClick={() => setEdit({ open: false })} disabled={updateMutation.status === 'pending'}>Cancel</button>
              <button onClick={handleSave} disabled={updateMutation.status === 'pending'}>{updateMutation.status === 'pending' ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {invite.open && invite.tenant && (
        <div style={modalStyle}>
          <div style={panelStyle}>
            <h4 style={{marginTop:0}}>Invite Admin – {invite.tenant.name}</h4>
            <input placeholder="admin@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{width:'100%', padding:'6px 8px', marginBottom:8}} />
            <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button onClick={() => { setInvite({ open: false }); setInviteResult(null);} } disabled={inviteLoading}>Close</button>
              <button onClick={handleInvite} disabled={inviteLoading || !inviteEmail}>{inviteLoading ? 'Sending…' : 'Send Invite'}</button>
            </div>
            {inviteResult && <div style={{marginTop:10, fontSize:12, wordBreak:'break-all'}}>{inviteResult}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const modalStyle: React.CSSProperties = {
  position:'fixed', top:0, left:0, right:0, bottom:0,
  background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
};
const panelStyle: React.CSSProperties = {
  background:'#fff', padding:'1.2rem 1rem', borderRadius:8, width:'520px', maxWidth:'90%', boxShadow:'0 4px 24px rgba(0,0,0,0.18)'
};
const editLabelStyle: React.CSSProperties = { display:'flex', flexDirection:'column', fontSize:12, marginBottom:6, gap:4 };
const inputStyle: React.CSSProperties = { padding:'6px 8px', border:'1px solid #ccc', borderRadius:4, fontSize:12 };
