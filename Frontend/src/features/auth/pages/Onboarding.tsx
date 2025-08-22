import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../../api/api';
import Loading from '../../../components/Loading';

interface OnboardingLocationState {
	email?: string;
	password?: string;
	fromSocialLogin?: boolean;
	skipProfileStep?: boolean;
	firstName?: string;
	lastName?: string;
}


const Onboarding: React.FC = () => {
	const navigate = useNavigate();
		const location = useLocation();
		const state = useMemo(() => (location.state as OnboardingLocationState) || {}, [location.state]);
	const [firstName, setFirstName] = useState(state?.firstName || '');
	const [lastName, setLastName] = useState(state?.lastName || '');
	const [phone, setPhone] = useState('');
	const [subscribe, setSubscribe] = useState(false);
	const [loading, setLoading] = useState(false);

	// If this is a social login user who already has profile info, skip to phone verification
	React.useEffect(() => {
		if (state?.skipProfileStep && state?.email && state?.firstName && state?.lastName) {
			console.log("🚀 Social login user detected, skipping to phone verification");
			console.log("📧 User data:", { 
				email: state.email, 
				firstName: state.firstName, 
				lastName: state.lastName 
			});
			
			navigate('/onboarding/verify', {
				state: { 
					email: state.email, 
					firstName: state.firstName, 
					lastName: state.lastName, 
					phone: '', // Will be entered in phone verification step
					subscribe: false, // Default value
					fromSocialLogin: true 
				},
			});
		}
	}, [state, navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			// For social login users, update profile info in backend before proceeding
			if (state?.fromSocialLogin) {
				await api.put('/auth/me', { first_name: firstName, last_name: lastName });
			}
			// Navigate to OTP verification step
			navigate('/onboarding/verify', {
				state: { 
					email: state?.email, 
					password: state?.password, 
					firstName, 
					lastName, 
					phone, 
					subscribe,
					fromSocialLogin: state?.fromSocialLogin 
				},
			});
		} catch (err) {
			console.error('Onboarding profile update failed', err);
		} finally {
			setLoading(false);
		}
	};

	if (loading) return <Loading text="Processing…" />;

	return (
		<div className="container mx-auto p-4 max-w-md">
			<h2 className="text-2xl font-semibold mb-4">Complete Your Profile</h2>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="block text-sm font-medium">First Name</label>
					<input
						type="text"
						required
						className="mt-1 block w-full border rounded p-2"
						value={firstName}
						onChange={(e) => setFirstName(e.target.value)}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium">Last Name</label>
					<input
						type="text"
						required
						className="mt-1 block w-full border rounded p-2"
						value={lastName}
						onChange={(e) => setLastName(e.target.value)}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium">Phone Number</label>
					<input
						type="tel"
						required
						className="mt-1 block w-full border rounded p-2"
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
					/>
				</div>
				<div className="flex items-center">
					<input
						type="checkbox"
						id="subscribe"
						checked={subscribe}
						onChange={(e) => setSubscribe(e.target.checked)}
						className="mr-2"
					/>
					<label htmlFor="subscribe" className="text-sm">
						Subscribe to updates
					</label>
				</div>
				<button
					type="submit"
					className="w-full bg-blue-600 text-white p-2 rounded"
				>
					Continue
				</button>
			</form>
		</div>
	);
};

export default Onboarding;
