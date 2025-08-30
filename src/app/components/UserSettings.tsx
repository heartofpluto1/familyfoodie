'use client';

import { useState, useEffect } from 'react';
import { CloseIcon } from './Icons';
import InvitationModal from './InvitationModal';

interface HouseholdData {
	household_name: string;
	members: string[];
}

interface UserSettingsProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function UserSettings({ isOpen, onClose }: UserSettingsProps) {
	const [householdData, setHouseholdData] = useState<HouseholdData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showInviteModal, setShowInviteModal] = useState(false);

	useEffect(() => {
		if (isOpen) {
			fetchHouseholdData();
		}
	}, [isOpen]);

	const fetchHouseholdData = async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch('/api/settings');

			if (!response.ok) {
				throw new Error('Failed to fetch household data');
			}

			const data = await response.json();
			setHouseholdData(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred');
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			{/* Backdrop */}
			{isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300" onClick={onClose} />}

			{/* Slide-out panel */}
			<div
				className={`fixed top-0 right-0 h-full w-80 bg-surface border-l border-custom shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
					isOpen ? 'translate-x-0' : 'translate-x-full'
				}`}
			>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-custom">
					<h2 className="text-lg font-semibold text-foreground">Settings</h2>
					<button
						onClick={onClose}
						className="p-2 rounded-sm text-secondary hover:text-foreground hover:bg-accent/10 transition-colors"
						title="Close settings"
					>
						<CloseIcon className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4 space-y-6">
					{loading ? (
						<div className="flex justify-center py-8">
							<div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
						</div>
					) : error ? (
						<div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-sm p-3">{error}</div>
					) : householdData ? (
						<>
							{/* Household Name */}
							<div>
								<h3 className="text-sm font-medium text-foreground mb-2">Household</h3>
								<p className="text-foreground font-medium">{householdData.household_name}</p>
							</div>

							{/* Household Members */}
							<div>
								<h3 className="text-sm font-medium text-foreground mb-2">Members ({householdData.members.length})</h3>
								<div className="space-y-1 mb-3">
									{householdData.members.map((member, index) => (
										<p 
											key={index} 
											className={`text-sm ${
												member.includes('(pending)') 
													? 'text-muted italic' 
													: 'text-secondary'
											}`}
										>
											{member}
										</p>
									))}
								</div>
								
								{/* Invite Button */}
								<button
									onClick={() => setShowInviteModal(true)}
									className="w-full px-3 py-2 bg-accent text-background rounded-sm hover:bg-accent/90 transition-colors text-sm font-medium"
								>
									Invite Another Member
								</button>
							</div>
						</>
					) : null}
				</div>
			</div>
			
			{/* Invitation Modal */}
			<InvitationModal
				isOpen={showInviteModal}
				onClose={() => setShowInviteModal(false)}
				householdName={householdData?.household_name || 'your household'}
				onInvitationSent={() => {
					// Refresh the household data to show the new pending invitation
					fetchHouseholdData();
				}}
			/>
		</>
	);
}
