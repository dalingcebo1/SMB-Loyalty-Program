import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUsage, fetchTenantModules, fetchUsageTrend, UsageTrendResponse } from '../../api/subscriptionAdmin';
import api from '../../api/api';
import { usePersistedState } from '../../features/core/hooks/usePersistedState';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';
import { toast } from 'react-toastify';

interface UsageRow { module_key:string; count:number; updated_at:string|null }
interface Tenant { id:string; name?:string }

const fallbackTenants: Tenant[] = [{ id:'default', name:'Default'}];

type SortKey = 'module' | 'count' | 'updated';

export const SubscriptionUsagePage: React.FC = () => {
  const [tenantId, setTenantId] = usePersistedState<string>('admin.selectedTenant','default');
  const tenantsQuery = useQuery<Tenant[]>({
    queryKey:['tenants'],
    queryFn: async ()=> { try { const {data} = await api.get('/tenants'); return data as Tenant[]; } catch { return fallbackTenants; } },
    staleTime: 60_000
  });

  const usageQuery = useQuery<UsageRow[]>({ queryKey:['usage',tenantId], queryFn:()=>fetchUsage(tenantId), enabled: !!tenantId, staleTime: 30_000 });
  const modulesQuery = useQuery({ queryKey:['tenantModules', tenantId], queryFn:()=>fetchTenantModules(tenantId), enabled: !!tenantId });
  const [trendHours, setTrendHours] = usePersistedState<number>('usage.trendHours',24);
  const [trendSample, setTrendSample] = usePersistedState<number|''>('usage.trendSample','');
  const trendQuery = useQuery<UsageTrendResponse>({
    queryKey:['usageTrend', tenantId, trendHours, trendSample||'none'],
    queryFn:()=>fetchUsageTrend(tenantId, trendHours, trendSample||undefined),
    enabled: !!tenantId
  });

  // Local UI state
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('count');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('desc');
  const [view, setView] = usePersistedState<'table'|'bars'|'trend'>('usage.view','table');
  const [minThreshold, setMinThreshold] = usePersistedState<number|''>('usage.min','');
  const [threshold, setThreshold] = usePersistedState<number|''>('usage.threshold','');
  const [autoRefresh, setAutoRefresh] = usePersistedState<boolean>('usage.autoRefresh',true);
  const [refreshInterval, setRefreshInterval] = usePersistedState<number>('usage.refreshInterval',15000);
  const [page, setPage] = React.useState(1);
  const [onlyActive, setOnlyActive] = usePersistedState<boolean>('usage.onlyActive', false);
  const [planFilter, setPlanFilter] = React.useState<'all'|'included'|'addon'>('all');
  const [showPercentBars, setShowPercentBars] = usePersistedState<boolean>('usage.showPercentBars', false);
  const [selectedModule, setSelectedModule] = React.useState<string|null>(null);
  // Consistent time / datetime formatting
  const timeFormatter = React.useMemo(()=> new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit'}), []);
  const dateTimeFormatter = React.useMemo(()=> new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'}), []);
  const pageSize = 25;

  // Enrich usage rows with module metadata (category, in_plan, effective)
  const enriched = React.useMemo(()=>{
    const meta = modulesQuery.data || [];
    return (usageQuery.data||[]).map(r=> {
      const m = meta.find(mm=> mm.key===r.module_key);
      return {
        ...r,
        category: m?.category || 'uncategorized',
        in_plan: m?.in_plan ?? false,
        effective: m?.effective ?? false,
        override: m?.override
      };
    });
  }, [usageQuery.data, modulesQuery.data]);

  const categories = React.useMemo(()=>{
    const s = new Set<string>();
    enriched.forEach(r=> s.add(r.category));
    return Array.from(s).sort();
  }, [enriched]);
  const [category, setCategory] = React.useState('');

  const filtered = React.useMemo(()=>{
    return enriched
      .filter(r=> !search || r.module_key.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase()))
      .filter(r=> !category || r.category===category)
      .filter(r=> (minThreshold==='' || r.count >= minThreshold))
      .filter(r=> planFilter==='all' || (planFilter==='included' ? r.in_plan : !r.in_plan));
  }, [enriched, search, category, minThreshold, planFilter]);

  const activeFiltered = React.useMemo(()=> onlyActive ? filtered.filter(r=> r.effective) : filtered, [filtered, onlyActive]);

  const sorted = React.useMemo(()=>{
    const arr = [...activeFiltered];
    arr.sort((a,b)=>{
      let cmp = 0;
      if(sortKey==='module') cmp = a.module_key.localeCompare(b.module_key);
      else if(sortKey==='count') cmp = a.count - b.count;
      else if(sortKey==='updated') cmp = (a.updated_at||'').localeCompare(b.updated_at||'');
      return sortDir==='asc'? cmp : -cmp;
    });
    return arr;
  }, [activeFiltered, sortKey, sortDir]);

  const paginated = React.useMemo(()=>{
    const start = (page-1)*pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  // Auto-refresh effect
  React.useEffect(()=>{
    if(!autoRefresh) return;
    const id = setInterval(()=> { usageQuery.refetch(); }, refreshInterval);
    return ()=> clearInterval(id);
  }, [autoRefresh, refreshInterval, usageQuery]);

  const totalEvents = React.useMemo(()=> enriched.reduce((sum,r)=> sum + r.count, 0), [enriched]);
  const maxCount = React.useMemo(()=> enriched.reduce((m,r)=> Math.max(m,r.count), 0), [enriched]);
  const avgPerModule = React.useMemo(()=> enriched.length? Math.round(totalEvents / enriched.length):0, [totalEvents, enriched.length]);
  const topModule = React.useMemo(()=> enriched.slice().sort((a,b)=> b.count - a.count)[0]?.module_key || '—', [enriched]);
  const thresholdExceedCount = React.useMemo(()=> threshold===''? 0 : enriched.filter(r=> r.count >= threshold).length, [enriched, threshold]);
  const topModuleShare = React.useMemo(()=> {
    if(!totalEvents) return '—';
    const tm = enriched.find(e=> e.module_key===topModule);
    return tm ? ((tm.count/totalEvents)*100).toFixed(1)+'%' : '—';
  }, [totalEvents, enriched, topModule]);
  const activeCount = React.useMemo(()=> enriched.filter(r=> r.effective).length, [enriched]);
  const inactiveCount = React.useMemo(()=> enriched.length - activeCount, [enriched, activeCount]);
  const loading = usageQuery.isLoading || modulesQuery.isLoading;
  const kpiLoading = loading;

  const toggleSort = (k:SortKey)=>{
    if(sortKey===k) setSortDir(d=> d==='asc'?'desc':'asc'); else { setSortKey(k); setSortDir(k==='count'?'desc':'asc'); }
  };

  const exportCsv = ()=>{
    if(!sorted.length) return;
    const header = 'module_key,count,updated_at,category,in_plan,effective\n';
    const lines = sorted.map(r=> [r.module_key, r.count, r.updated_at||'', r.category, r.in_plan, r.effective].join(','));
    const blob = new Blob([header + lines.join('\n')], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `usage_${tenantId}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const exportTrendCsv = ()=>{
    if(!trendQuery.data) return;
    const rows:string[] = [];
    // header
    rows.push('module_key,timestamp,value');
    trendQuery.data.series.forEach(s=>{
      s.points.forEach(p=> rows.push(`${s.module_key},${new Date(p.t).toISOString()},${p.value}`));
    });
    const blob = new Blob([rows.join('\n')], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`usage_trend_${tenantId}_${trendHours}h.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const copyJson = ()=>{
    navigator.clipboard.writeText(JSON.stringify(sorted, null, 2)).then(()=>{}).catch(()=>{});
  };

  // Threshold alert side-effect (toast when any module crosses threshold latest count)
  const lastThresholdRef = React.useRef<number|''>(threshold);
  React.useEffect(()=>{ lastThresholdRef.current = threshold; }, [threshold]);
  React.useEffect(()=>{
    if(threshold==='') return;
    const over = enriched.filter(r=> r.count >= threshold);
    if(over.length){
      toast.warn(`${over.length} module${over.length>1?'s':''} at or above threshold (${threshold})`, { toastId:'usage-threshold'});
    }
  }, [enriched, threshold]);

  // loading moved above for early KPI skeleton usage

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <header className="bg-white rounded-xl shadow-sm border p-6 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Usage Analytics</h1>
              <p className="text-gray-600 mt-1">Real-time counts per active module for the selected tenant.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Tenant</label>
                <select value={tenantId} onChange={e=>setTenantId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[150px]">
                  {(tenantsQuery.data||fallbackTenants).map(t=> <option key={t.id} value={t.id}>{t.name||t.id}</option>)}
                </select>
                {tenantsQuery.isLoading && <span className="text-xs text-gray-500">Loading…</span>}
              </div>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button onClick={()=>setView('table')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view==='table'?'bg-white text-gray-900 shadow-sm':'text-gray-600 hover:text-gray-900'}`}>Table</button>
                <button onClick={()=>setView('bars')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view==='bars'?'bg-white text-gray-900 shadow-sm':'text-gray-600 hover:text-gray-900'}`}>Bars</button>
                <button onClick={()=>setView('trend')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view==='trend'?'bg-white text-gray-900 shadow-sm':'text-gray-600 hover:text-gray-900'}`}>Trend</button>
              </div>
              <div className="flex gap-2">
                <button onClick={exportCsv} disabled={!sorted.length} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Export CSV</button>
                <button onClick={copyJson} disabled={!sorted.length} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Copy JSON</button>
                {view==='trend' && <button onClick={exportTrendCsv} disabled={!trendQuery.data} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Trend CSV</button>}
                <button onClick={()=>{ usageQuery.refetch(); trendQuery.refetch(); }} className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">Refresh</button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Total Events</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-16 bg-gray-200 rounded animate-pulse"/>: totalEvents}</span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Modules Tracked</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-12 bg-gray-200 rounded animate-pulse"/>: enriched.length}</span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Max Per Module</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-12 bg-gray-200 rounded animate-pulse"/>: maxCount}</span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Avg / Module</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-10 bg-gray-200 rounded animate-pulse"/>: avgPerModule}</span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Top Module</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-20 bg-gray-200 rounded animate-pulse"/>: topModule}</span></div>
            {threshold!=='' && <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">≥ Threshold</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-10 bg-gray-200 rounded animate-pulse"/>: thresholdExceedCount}</span></div>}
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Top Share</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-14 bg-gray-200 rounded animate-pulse"/>: topModuleShare}</span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Active</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-10 bg-gray-200 rounded animate-pulse"/>: activeCount}</span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Inactive</span><span className="text-xl font-semibold text-gray-900">{kpiLoading? <span className="inline-block h-6 w-10 bg-gray-200 rounded animate-pulse"/>: inactiveCount}</span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Last Refresh</span><span className="text-xl font-semibold text-gray-900">{timeFormatter.format(new Date())}</span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Auto Refresh</span><span><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /> <span className="text-gray-700">{autoRefresh?'On':'Off'}</span></label></span></div>
            <div className="flex flex-col"><span className="text-xs uppercase tracking-wide text-gray-500">Interval</span><span>
              <select value={refreshInterval} onChange={e=> setRefreshInterval(Number(e.target.value))} className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                {[5000,15000,30000,60000].map(ms=> <option key={ms} value={ms}>{ms/1000}s</option>)}
              </select>
            </span></div>
          </div>
        </header>

        {/* Filters */}
        <section className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
          <div className="grid md:grid-cols-6 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Search</label>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search modules or category..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">All</option>
                {categories.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Min Count</label>
              <input type="number" min={0} value={minThreshold} onChange={e=> setMinThreshold(e.target.value===''? '': Number(e.target.value))} placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Alert Threshold</label>
              <input type="number" min={0} value={threshold} onChange={e=> setThreshold(e.target.value===''? '': Number(e.target.value))} placeholder="e.g. 1000" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Trend Window (h)</label>
              <select value={trendHours} onChange={e=> setTrendHours(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                {[6,12,24,48,72].map(h=> <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Trend Sample</label>
              <select value={trendSample} onChange={e=> setTrendSample(e.target.value===''? '': Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">All</option>
                {[25,50,100].map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Plan Filter</label>
              <select value={planFilter} onChange={e=> setPlanFilter(e.target.value as 'all'|'included'|'addon')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="all">All</option>
                <option value="included">Included</option>
                <option value="addon">Add-on</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center text-xs text-gray-600">
            <span>{sorted.length} result{sorted.length!==1 && 's'}</span>
            {search && <button onClick={()=>setSearch('')} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Clear search</button>}
            {(category || minThreshold!=='') && <button onClick={()=>{setCategory(''); setMinThreshold('');}} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Reset filters</button>}
            <label className="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={onlyActive} onChange={e=> setOnlyActive(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span>Only Active</span></label>
            <label className="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showPercentBars} onChange={e=> setShowPercentBars(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span>Percent Bars</span></label>
            {loading && <span className="flex items-center gap-1"><span className="animate-spin h-3 w-3 rounded-full border-b-2 border-indigo-600"/>Refreshing…</span>}
          </div>
        </section>

        {/* Data Presentation */}
        <section className="space-y-6">
          {view==='bars' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Distribution</h2>
              {!sorted.length && !loading && <p className="text-sm text-gray-500">No usage data to visualize.</p>}
              <div className="space-y-2">
                {sorted.map(r=> {
                  const pct = maxCount? (r.count / maxCount) * 100 : 0;
                  return (
                    <div key={r.module_key} className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span className="font-medium text-gray-800">{r.module_key}</span>
                        <span>{r.count}{showPercentBars && totalEvents>0 && <span className="ml-1 text-[10px] text-gray-500">({((r.count/totalEvents)*100).toFixed(1)}%)</span>}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded overflow-hidden">
                        <div className={`h-full bg-indigo-600`} style={{width: pct+'%'}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view==='table' && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer" onClick={()=>toggleSort('module')}>Module {sortKey==='module' && (sortDir==='asc'?'▲':'▼')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer" onClick={()=>toggleSort('count')}>Count {sortKey==='count' && (sortDir==='asc'?'▲':'▼')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer" onClick={()=>toggleSort('updated')}>Updated {sortKey==='updated' && (sortDir==='asc'?'▲':'▼')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Plan</th>
                    </tr>
                  </thead>
                  <tbody>
          {paginated.map(r=> {
                      const stale = r.updated_at ? (Date.now() - Date.parse(r.updated_at)) > 1000*60*60*24 : true;
                      return (
            <tr key={r.module_key} onClick={()=> setSelectedModule(r.module_key)} className="border-b last:border-b-0 hover:bg-indigo-50 cursor-pointer transition-colors" title="View module details" role="button" tabIndex={0} onKeyDown={(e)=> { if(e.key==='Enter' || e.key===' ') { e.preventDefault(); setSelectedModule(r.module_key);} }}>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.module_key}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.category}</td>
                          <td className={`px-4 py-3 text-gray-900 font-medium ${threshold!=='' && r.count >= threshold ? 'text-red-600' : ''}`}>
                            {r.count}
                            {trendQuery.data && (()=>{
                              const series = trendQuery.data.series.find(s=> s.module_key===r.module_key);
                              if(series && series.points.length>=2){
                                const a = series.points[series.points.length-2].value;
                                const b = series.points[series.points.length-1].value;
                                if(a>0){
                                  const pct = ((b - a)/a)*100;
                                  const formatted = (pct>0?'+':'') + pct.toFixed(1)+'%';
                                  return <span className={`ml-2 text-[10px] px-1 py-0.5 rounded ${pct>=0?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{formatted}</span>;
                                } else if (a===0 && b>0){
                                  return <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-green-100 text-green-700">+∞%</span>;
                                } else if (a===0 && b===0){
                                  return <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-600">N/A</span>;
                                }
                              }
                              return null;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{r.updated_at? dateTimeFormatter.format(new Date(r.updated_at)): '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${r.effective? 'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{r.effective? 'Active':'Inactive'}</span>
                            {stale && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Stale</span>}
                          </td>
                          <td className="px-4 py-3">
                            {r.in_plan ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">Included</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">Add-on</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between p-4 border-t bg-gray-50 text-xs text-gray-600 flex-wrap gap-3">
                <div>Page {page} / {totalPages} • Showing {paginated.length} of {sorted.length}</div>
                <div className="flex gap-2">
                  <button disabled={page===1} onClick={()=>setPage(p=> Math.max(1,p-1))} className="px-2 py-1 border rounded disabled:opacity-40 bg-white hover:bg-gray-100">Prev</button>
                  <button disabled={page===totalPages} onClick={()=>setPage(p=> Math.min(totalPages,p+1))} className="px-2 py-1 border rounded disabled:opacity-40 bg-white hover:bg-gray-100">Next</button>
                </div>
              </div>
              {!sorted.length && !loading && (
                <div className="p-8 text-center text-sm text-gray-500">No matching usage records.</div>
              )}
              {loading && (
                <div className="p-8 text-center text-sm text-gray-500 flex items-center justify-center gap-2"><span className="animate-spin h-4 w-4 rounded-full border-b-2 border-indigo-600"/>Loading usage…</div>
              )}
            </div>
          )}

          {view==='trend' && (
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Trend (Last {trendHours}h)</h2>
                <p className="text-xs text-gray-500">Aggregate timeline plus per-module sparklines. Window: {trendHours}h.</p>
              </div>
              {trendQuery.isLoading && <p className="text-sm text-gray-500">Loading trend…</p>}
              {trendQuery.isError && <p className="text-sm text-red-600">Failed to load trend data.</p>}
              {!trendQuery.isLoading && !trendQuery.isError && trendQuery.data && (
                <>
                  {/* Aggregate multi-series line chart */}
                  <TimeSeriesChart
                    title="Aggregate Usage"
                    series={trendQuery.data.series.slice(0,6).map((s)=> ({
                      name: s.module_key,
                      data: s.points.map(p=> ({ date: new Date(p.t).toLocaleTimeString(), value: p.value }))
                    }))}
                    height={300}
                    yLabel="Count"
                  />
                  <div className="grid md:grid-cols-3 gap-6">
                    {trendQuery.data.series.map(s=> (
                      <div key={s.module_key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-medium text-gray-800 truncate" title={s.module_key}>{s.module_key}</h3>
                          {threshold!=='' && s.points[s.points.length-1]?.value >= threshold && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">High</span>
                          )}
                        </div>
                        <div className="h-24 bg-gray-50 rounded p-1 flex items-end gap-[2px]">
                          {s.points.map(p=> {
                            const localMax = Math.max(...s.points.map(pp=>pp.value),1);
                            const h = (p.value / localMax) * 100;
                            return <div key={p.t} className={`flex-1 rounded-sm ${threshold!=='' && p.value>=threshold? 'bg-red-400':'bg-indigo-400'} transition-all`} style={{height: h+'%'}} title={`${p.value} @ ${new Date(p.t).toLocaleTimeString()}`} />;
                          })}
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-500">
                          <span>{new Date(s.points[0].t).toLocaleTimeString()}</span>
                          <span>{new Date(s.points[s.points.length-1].t).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
        {selectedModule && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end md:items-center justify-center z-40" onClick={()=> setSelectedModule(null)}>
            <div className="bg-white w-full md:max-w-xl max-h-[90vh] rounded-t-2xl md:rounded-2xl shadow-xl border flex flex-col" onClick={e=> e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Usage details for ${selectedModule}`}>
              <div className="p-4 border-b flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-gray-900 truncate">{selectedModule}</h3>
                <button onClick={()=> setSelectedModule(null)} className="p-2 rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label="Close">✕</button>
              </div>
              <div className="p-4 overflow-y-auto space-y-4">
                {(() => {
                  const series = trendQuery.data?.series.find(s=> s.module_key===selectedModule);
                  if(!series) return <p className="text-sm text-gray-500">No trend data available for this module in current window.</p>;
                  const last = series.points[series.points.length-1];
                  const first = series.points[0];
                  const delta = last.value - first.value;
                  const pct = first.value>0? ((delta/first.value)*100).toFixed(1)+'%' : '—';
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div className="flex flex-col"><span className="uppercase tracking-wide text-gray-500">First</span><span className="text-sm font-medium text-gray-900">{first.value}</span></div>
                        <div className="flex flex-col"><span className="uppercase tracking-wide text-gray-500">Last</span><span className="text-sm font-medium text-gray-900">{last.value}</span></div>
                        <div className="flex flex-col"><span className="uppercase tracking-wide text-gray-500">Δ (Pct)</span><span className="text-sm font-medium text-gray-900">{delta} ({pct})</span></div>
                      </div>
                      <TimeSeriesChart
                        title="Module Trend"
                        series={[{ name: selectedModule, data: series.points.map(p=> ({ date: new Date(p.t).toLocaleTimeString(), value: p.value })) }]}
                        height={240}
                        yLabel="Count"
                      />
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionUsagePage;
