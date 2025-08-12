import React from 'react';
import Container from '../../components/ui/Container';

const AnalyticsOverview: React.FC = () => (
  <Container>
    <div className="grid md:grid-cols-2 gap-10">
      <section>
        <h2 className="text-3xl font-semibold mb-4 tracking-tight">User Metrics</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-6 h-96 flex items-center justify-center">
          <span className="text-gray-400">User metrics chart placeholder</span>
        </div>
      </section>
      <section>
        <h2 className="text-3xl font-semibold mb-4 tracking-tight">Transaction Metrics</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-6 h-96 flex items-center justify-center">
          <span className="text-gray-400">Transaction metrics chart placeholder</span>
        </div>
      </section>
    </div>
  </Container>
);

export default AnalyticsOverview;
