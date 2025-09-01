'use client';

import { useState } from 'react';
import { Feedback, FeedbackStatus } from '@/types/feedback';
import ConfirmDialog from '@/app/components/ConfirmDialog';

interface FeedbackTableProps {
	feedback: Feedback[];
	onStatusUpdate: (id: number, status: FeedbackStatus) => void;
	onDelete: (id: number) => void;
}

export default function FeedbackTable({ feedback, onStatusUpdate, onDelete }: FeedbackTableProps) {
	const [expandedId, setExpandedId] = useState<number | null>(null);
	const [editingNotes, setEditingNotes] = useState<{ id: number; notes: string } | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; feedbackId: number | null }>({
		isOpen: false,
		feedbackId: null,
	});

	const getCategoryColor = (category: string) => {
		switch (category) {
			case 'bug':
				return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
			case 'feature_request':
				return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400';
			case 'praise':
				return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
			default:
				return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400';
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'new':
				return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400';
			case 'reviewed':
				return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400';
			case 'actioned':
				return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
			case 'closed':
				return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400';
			default:
				return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400';
		}
	};

	const renderStars = (rating: number | null) => {
		if (!rating) return <span className="text-muted dark:text-gray-400">-</span>;
		return (
			<span className="text-yellow-500">
				{'★'.repeat(rating)}
				<span className="text-gray-300 dark:text-gray-600">{'★'.repeat(5 - rating)}</span>
			</span>
		);
	};

	const handleSaveNotes = async (id: number) => {
		if (!editingNotes) return;

		try {
			const response = await fetch(`/api/feedback/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ adminNotes: editingNotes.notes }),
			});

			if (!response.ok) {
				throw new Error('Failed to save notes');
			}

			setEditingNotes(null);
		} catch (error) {
			console.error('Error saving notes:', error);
		}
	};

	if (feedback.length === 0) {
		return (
			<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm p-8 text-center">
				<p className="text-muted dark:text-gray-400">No feedback found matching your filters.</p>
			</div>
		);
	}

	return (
		<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm overflow-hidden">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-custom dark:border-gray-700">
						<tr>
							<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Date</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">User</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Rating</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Category</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Message</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Status</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody className="bg-white dark:bg-gray-800 divide-y divide-light dark:divide-gray-700">
						{feedback.map(item => (
							<tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
								<td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-gray-400">{new Date(item.created_at).toLocaleDateString()}</td>
								<td className="px-6 py-4 whitespace-nowrap">
									<div>
										<div className="text-sm font-medium text-foreground dark:text-gray-200">{item.user_name || 'Unknown'}</div>
										<div className="text-sm text-muted dark:text-gray-400">{item.user_email}</div>
									</div>
								</td>
								<td className="px-6 py-4 whitespace-nowrap text-sm">{renderStars(item.rating)}</td>
								<td className="px-6 py-4 whitespace-nowrap">
									<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(item.category)}`}>
										{item.category.replace('_', ' ')}
									</span>
								</td>
								<td className="px-6 py-4 text-sm text-foreground dark:text-gray-300">
									{item.message ? (
										<div>
											<p className="truncate max-w-xs">{item.message}</p>
											{item.message.length > 50 && (
												<button
													onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
													className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
												>
													{expandedId === item.id ? 'Show less' : 'Show more'}
												</button>
											)}
										</div>
									) : (
										<span className="text-muted dark:text-gray-400">No message</span>
									)}
								</td>
								<td className="px-6 py-4 whitespace-nowrap">
									<select
										value={item.status}
										onChange={e => onStatusUpdate(item.id, e.target.value as FeedbackStatus)}
										className={`text-xs font-medium px-2 py-1 rounded-full border-0 ${getStatusColor(item.status)}`}
									>
										<option value="new">New</option>
										<option value="reviewed">Reviewed</option>
										<option value="actioned">Actioned</option>
										<option value="closed">Closed</option>
									</select>
								</td>
								<td className="px-6 py-4 whitespace-nowrap text-sm">
									<div className="flex gap-3">
										<button
											onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
											className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
										>
											Details
										</button>
										<button
											onClick={() => setDeleteConfirm({ isOpen: true, feedbackId: item.id })}
											className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
										>
											Delete
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Expanded Details */}
			{expandedId && (
				<div className="border-t border-custom dark:border-gray-700">
					{feedback
						.filter(item => item.id === expandedId)
						.map(item => (
							<div key={item.id} className="p-6 bg-gray-50 dark:bg-gray-900/50">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<h4 className="text-foreground dark:text-gray-200 mb-2">Full Message</h4>
										<p className="text-sm text-foreground dark:text-gray-300 whitespace-pre-wrap">{item.message || 'No message provided'}</p>
									</div>
									<div>
										<h4 className="text-foreground dark:text-gray-200 mb-2">Context</h4>
										<div className="space-y-2 text-sm">
											<div>
												<span className="text-muted dark:text-gray-400">Page:</span>{' '}
												<span className="text-foreground dark:text-gray-300">{item.page_context}</span>
											</div>
											<div>
												<span className="text-muted dark:text-gray-400">Submitted:</span>{' '}
												<span className="text-foreground dark:text-gray-300">{new Date(item.created_at).toLocaleString()}</span>
											</div>
											{item.reviewed_at && (
												<div>
													<span className="text-muted dark:text-gray-400">Reviewed:</span>{' '}
													<span className="text-foreground dark:text-gray-300">{new Date(item.reviewed_at).toLocaleString()}</span>
												</div>
											)}
										</div>
									</div>
								</div>

								{/* Admin Notes */}
								<div className="mt-4">
									<h4 className="text-foreground dark:text-gray-200 mb-2">Admin Notes</h4>
									{editingNotes?.id === item.id ? (
										<div>
											<textarea
												value={editingNotes.notes}
												onChange={e => setEditingNotes({ ...editingNotes, notes: e.target.value })}
												className="w-full px-3 py-2 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-foreground dark:text-gray-100"
												rows={3}
											/>
											<div className="mt-2 space-x-2">
												<button
													onClick={() => handleSaveNotes(item.id)}
													className="px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded-sm text-sm hover:bg-green-700 dark:hover:bg-green-600"
												>
													Save
												</button>
												<button
													onClick={() => setEditingNotes(null)}
													className="px-3 py-1 bg-gray-600 dark:bg-gray-700 text-white rounded-sm text-sm hover:bg-gray-700 dark:hover:bg-gray-600"
												>
													Cancel
												</button>
											</div>
										</div>
									) : (
										<div>
											<p className="text-sm text-foreground dark:text-gray-300">{item.admin_notes || 'No notes added'}</p>
											<button
												onClick={() => setEditingNotes({ id: item.id, notes: item.admin_notes || '' })}
												className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
											>
												{item.admin_notes ? 'Edit notes' : 'Add notes'}
											</button>
										</div>
									)}
								</div>
							</div>
						))}
				</div>
			)}

			{/* Delete Confirmation Dialog */}
			<ConfirmDialog
				isOpen={deleteConfirm.isOpen}
				title="Delete Feedback"
				message="Are you sure you want to delete this feedback? This action cannot be undone."
				confirmText="Delete"
				cancelText="Cancel"
				onConfirm={() => {
					if (deleteConfirm.feedbackId) {
						onDelete(deleteConfirm.feedbackId);
						setDeleteConfirm({ isOpen: false, feedbackId: null });
					}
				}}
				onCancel={() => setDeleteConfirm({ isOpen: false, feedbackId: null })}
			/>
		</div>
	);
}
