'use client';

import { useState } from 'react';
import { CloseIcon } from './Icons';

interface InvitationModalProps {
	isOpen: boolean;
	onClose: () => void;
	householdName: string;
	onInvitationSent?: () => void;
}

export default function InvitationModal({ isOpen, onClose, householdName, onInvitationSent }: InvitationModalProps) {
	const [email, setEmail] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string>('');

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email) {
			setError('Please enter an email address');
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch('/api/invitations/send', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to send invitation');
			}

			setSuccess(true);
			setSuccessMessage(data.message || 'Invitation sent successfully');
			setEmail('');

			// Notify parent component to refresh the members list
			if (onInvitationSent) {
				onInvitationSent();
			}

			// Close modal after 10 seconds
			setTimeout(() => {
				setSuccess(false);
				onClose();
			}, 10000);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to send invitation');
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		setEmail('');
		setError(null);
		setSuccess(false);
		setSuccessMessage('');
		onClose();
	};

	if (!isOpen) return null;

	return (
		<>
			{/* Backdrop */}
			<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300" onClick={handleClose} />

			{/* Modal */}
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4">
				<div className="bg-surface rounded-sm border border-custom shadow-xl">
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b border-custom">
						<h2 className="text-lg font-semibold text-foreground">Invite to {householdName}</h2>
						<button
							onClick={handleClose}
							className="p-1 rounded-sm text-secondary hover:text-foreground hover:bg-accent/10 transition-colors"
							title="Close"
						>
							<CloseIcon className="w-5 h-5" />
						</button>
					</div>

					{/* Body */}
					<div className="p-4">
						{success ? (
							<div className="py-8 text-center">
								<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
									<svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<p className="text-foreground font-medium">{successMessage}</p>
								{successMessage === 'Invitation sent successfully' && (
									<p className="text-secondary text-sm mt-1">The recipient will receive an email shortly.</p>
								)}
							</div>
						) : (
							<form onSubmit={handleSubmit}>
								<div className="mb-4">
									<label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
										Email Address
									</label>
									<input
										type="email"
										id="email"
										value={email}
										onChange={e => setEmail(e.target.value)}
										placeholder="Enter email address"
										className="w-full px-3 py-2 bg-background border border-custom rounded-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
										disabled={isLoading}
										autoFocus
									/>
									<p className="text-xs text-secondary mt-2">They&apos;ll receive an email invitation to join your household.</p>
								</div>

								{error && (
									<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm">
										<p className="text-sm text-red-600">{error}</p>
									</div>
								)}

								<div className="flex gap-3">
									<button
										type="button"
										onClick={handleClose}
										className="flex-1 px-4 py-2 border border-custom rounded-sm text-secondary hover:bg-accent/10 transition-colors"
										disabled={isLoading}
									>
										Cancel
									</button>
									<button
										type="submit"
										className="flex-1 px-4 py-2 bg-accent text-background rounded-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										disabled={isLoading}
									>
										{isLoading ? 'Sending...' : 'Send Invitation'}
									</button>
								</div>
							</form>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
