import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import MetricTable from '../../components/ui/MetricTable';
import api from '../../api/api';
import { ENGAGEMENT_LABELS } from '../../utils';
import { buildQuery } from '../../api/api';

const EngagementMetrics: React.FC = () => (
  <AdminMetricsPage<Record<string, any>>
    title="Engagement Metrics"
    queryKeyBase={['analytics','engagement','details']}
    fetcher={(start, end) => api.get(`/analytics/engagement/details${buildQuery({ start_date: start, end_date: end })}`).then(res => res.data)}
    render={data => <MetricTable data={data} labels={ENGAGEMENT_LABELS} />}
  />
);

export default EngagementMetrics;
