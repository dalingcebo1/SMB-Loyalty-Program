import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import api from '../../api/api';
import { buildQuery } from '../../api/api';
import { SUMMARY_LABELS } from '../../utils/metrics';
import MetricTable from '../../components/ui/MetricTable';

const LoyaltyMetrics: React.FC = () => (
  <AdminMetricsPage<Record<string, any>>
    title="Loyalty Metrics"
    queryKeyBase={['analytics','loyalty','details']}
    fetcher={(start, end) => api.get(`/analytics/loyalty/details${buildQuery({ start_date: start, end_date: end })}`).then(res => res.data)}
    render={data => <MetricTable data={data} labels={SUMMARY_LABELS} />}
  />
);

export default LoyaltyMetrics;
