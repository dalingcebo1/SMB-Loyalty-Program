// src/features/loyalty/pages/MyLoyalty.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { useLoyalty } from '../hooks/useLoyalty';
import { FaStar, FaTrophy, FaGift, FaArrowRight, FaHistory } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';
import type { RewardReady, UpcomingReward } from '../hooks/useLoyalty';
import './MyLoyalty.css';

const MyLoyalty: React.FC = () => {
	const navigate = useNavigate();
	const { user, loading } = useAuth();
	const { data, isLoading, isError } = useLoyalty(user?.phone || '');
	const [selectedReward, setSelectedReward] = useState<RewardReady | null>(null);
	const [showRewardModal, setShowRewardModal] = useState<boolean>(false);
	
	if (loading || isLoading) {
		return (
			<div className="loading-container">
				<CgSpinner className="loading-spinner" />
				<p>Loading your loyalty rewards...</p>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="error-container">
				<h2>Unable to load your loyalty information</h2>
				<p className="error-message">Please try again later</p>
				<button onClick={() => window.location.reload()} className="retry-button">
					Try Again
				</button>
			</div>
		);
	}

	if (!user) {
		return <div>Please log in to view your loyalty status.</div>;
	}

	const visits = data?.visits ?? 0;
	const rewards = data?.rewards_ready ?? [];
	const upcoming = data?.upcoming_rewards ?? [];
	const userName = data?.name || user.firstName || 'User';

	const handleRewardClick = (reward: RewardReady) => {
		setSelectedReward(reward);
		setShowRewardModal(true);
	};

	const closeModal = () => {
		setShowRewardModal(false);
		setSelectedReward(null);
	};

	const formatDate = (dateString?: string) => {
		if (!dateString) return 'Not specified';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	// Calculate progress for next milestone
	const nextMilestone = upcoming.length > 0 ? upcoming[0].milestone : visits + 5;
	const visitsNeeded = upcoming.length > 0 ? upcoming[0].visits_needed : 5;
	const currentProgress = Math.max(0, visits - (nextMilestone - visitsNeeded));
	const progressPercentage = (currentProgress / visitsNeeded) * 100;

	return (
		<div className="loyalty-page">
			<div className="loyalty-header">
				<h1>My Loyalty Rewards</h1>
				<p className="loyalty-subtitle">Welcome back, {userName}! Earn rewards with every visit!</p>
			</div>

			<div className="loyalty-stats-card">
				<div className="loyalty-stats">
					<div className="loyalty-stat-item visits">
						<FaHistory className="stat-icon" />
						<div className="stat-value">{visits}</div>
						<div className="stat-label">Total Visits</div>
					</div>
					<div className="loyalty-stat-item rewards">
						<FaTrophy className="stat-icon" />
						<div className="stat-value">{rewards.length}</div>
						<div className="stat-label">Rewards Ready</div>
					</div>
				</div>
			</div>

			<div className="loyalty-progress-section">
				<h2>Progress to Next Reward</h2>
				<div className="progress-container">
					<div className="progress-bar-container">
						<div 
							className="progress-bar" 
							style={{ width: `${progressPercentage}%` }}
						></div>
					</div>
					<div className="progress-labels">
						<span>{currentProgress} / {visitsNeeded}</span>
						<span>{visitsNeeded - currentProgress} more visit{visitsNeeded - currentProgress !== 1 ? 's' : ''} needed</span>
					</div>
				</div>
				{upcoming.length > 0 && (
					<div className="next-milestone">
						<FaStar className="milestone-icon" />
						<p>Next reward at {upcoming[0].milestone} visits: <strong>{upcoming[0].reward}</strong></p>
					</div>
				)}
			</div>

			<div className="loyalty-rewards-section">
				<h2>Available Rewards</h2>
				{rewards.length > 0 ? (
					<div className="rewards-grid">
						{rewards.map((reward, index) => (
							<div key={index} className="reward-card available" onClick={() => handleRewardClick(reward)}>
								<div className="reward-badge">
									<FaGift className="reward-icon" />
								</div>
								<div className="reward-content">
									<h3>{reward.reward}</h3>
									<div className="reward-milestone">Earned at {reward.milestone} visits</div>
									{reward.status && (
										<div className={`reward-status ${reward.status}`}>
											{reward.status.toUpperCase()}
										</div>
									)}
									<button className="view-reward-btn">View Reward <FaArrowRight /></button>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="no-rewards">
						<FaGift className="no-rewards-icon" />
						<p>You don't have any rewards available yet.</p>
						<p>Keep visiting us to earn rewards!</p>
						<button onClick={() => navigate('/order')} className="cta-button">Book a Service</button>
					</div>
				)}

				{upcoming.length > 0 && (
					<>
						<h2>Coming Soon</h2>
						<div className="rewards-grid">
							{upcoming.map((reward: UpcomingReward, index: number) => (
								<div key={index} className="reward-card upcoming">
									<div className="reward-badge locked">
										<FaGift className="reward-icon" />
									</div>
									<div className="reward-content">
										<h3>{reward.reward}</h3>
										<div className="reward-milestone">At {reward.milestone} visits</div>
										<div className="visits-needed">{reward.visits_needed} more visit{reward.visits_needed !== 1 ? 's' : ''} needed</div>
									</div>
								</div>
							))}
						</div>
					</>
				)}
			</div>

			{showRewardModal && selectedReward && (
				<div className="reward-modal-overlay" onClick={closeModal}>
					<div className="reward-modal" onClick={e => e.stopPropagation()}>
						<button className="close-modal" onClick={closeModal}>&times;</button>
						<h2>{selectedReward.reward}</h2>
						<div className="reward-details">
							<div className="detail-item">
								<span className="detail-label">Milestone:</span>
								<span className="detail-value">{selectedReward.milestone} visits</span>
							</div>
							{selectedReward.pin && (
								<div className="detail-item">
									<span className="detail-label">Redemption PIN:</span>
									<span className="detail-value highlight">{selectedReward.pin}</span>
								</div>
							)}
							{selectedReward.expiry_at && (
								<div className="detail-item">
									<span className="detail-label">Valid Until:</span>
									<span className="detail-value">{formatDate(selectedReward.expiry_at)}</span>
								</div>
							)}
							{selectedReward.status && (
								<div className="detail-item">
									<span className="detail-label">Status:</span>
									<span className={`detail-value status-${selectedReward.status}`}>{selectedReward.status.toUpperCase()}</span>
								</div>
							)}
						</div>
						<div className="modal-footer">
							<p className="redemption-instructions">
								Show this PIN to staff when redeeming your reward.
							</p>
							<button className="primary-button" onClick={closeModal}>Close</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default MyLoyalty;
