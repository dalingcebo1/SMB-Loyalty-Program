// src/features/loyalty/pages/MyLoyalty.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import PageLayout from '../../../components/PageLayout';
import { useLoyalty } from '../hooks/useLoyalty';

const MyLoyalty: React.FC = () => {
	const { user, loading } = useAuth();
	const { data, isLoading, isError } = useLoyalty(user?.phone || '');
	
	if (loading || isLoading) return <PageLayout loading />;
	if (!user) return <Navigate to="/login" replace />;
	if (isError) return <PageLayout error="Failed to load loyalty data." onRetry={() => window.location.reload()} />;

	const points = data?.points ?? 0;
	const rewards = data?.rewards_ready ?? [];

	return (
		<PageLayout>
			<div className="max-w-2xl mx-auto p-8">
				<h1 className="text-2xl font-bold mb-4">My Loyalty</h1>
				<p className="mb-6">Points Balance: <span className="font-semibold">{points}</span></p>
				<h2 className="text-xl font-semibold mb-2">Rewards Ready</h2>
				{rewards.length ? (
					<ul className="list-disc list-inside space-y-1">
						{rewards.map((r, idx) => (
							<li key={idx}>{r.reward} {r.expiry && `(expires ${new Date(r.expiry).toLocaleDateString()})`}</li>
						))}
					</ul>
				) : (
					<p>No rewards available.</p>
				)}
			</div>
		</PageLayout>
	);
};

export default MyLoyalty;
