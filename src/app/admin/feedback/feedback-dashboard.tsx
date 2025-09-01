'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import { Feedback, FeedbackStatus, FeedbackCategory, FeedbackStats } from '@/types/feedback';
import FeedbackTable from './feedback-table';

export default function FeedbackDashboard() {
	const { showToast } = useToast();
	const [feedback, setFeedback] = useState<Feedback[]>([]);
	const [stats, setStats] = useState<FeedbackStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | 'all'>('all');
	const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | 'all'>('all');
	const [selectedRating, setSelectedRating] = useState<number | 'all'>('all');
	const [dateRange, setDateRange] = useState({ start: '', end: '' });

	const fetchFeedback = useCallback(async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams();
			params.append('includeStats', 'true');

			if (selectedStatus !== 'all') {
				params.append('status', selectedStatus);
			}
			if (selectedCategory !== 'all') {
				params.append('category', selectedCategory);
			}
			if (selectedRating !== 'all') {
				params.append('rating', selectedRating.toString());
			}
			if (dateRange.start) {
				params.append('startDate', dateRange.start);
			}
			if (dateRange.end) {
				params.append('endDate', dateRange.end);
			}

			const response = await fetch(`/api/feedback?${params}`);
			if (!response.ok) {
				throw new Error('Failed to fetch feedback');
			}

			const data = await response.json();
			setFeedback(data.feedback);
			setStats(data.stats);
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to load feedback');
		} finally {
			setLoading(false);
		}
	}, [selectedStatus, selectedCategory, selectedRating, dateRange, showToast]);

	useEffect(() => {
		fetchFeedback();
	}, [fetchFeedback]);

	const handleStatusUpdate = async (id: number, status: FeedbackStatus) => {
		try {
			const response = await fetch(`/api/feedback/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status }),
			});

			if (!response.ok) {
				throw new Error('Failed to update status');
			}

			showToast('success', 'Success', 'Status updated successfully');
			fetchFeedback();
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to update status');
		}
	};

	const handleExport = () => {
		const csv = [
			['Date', 'User', 'Rating', 'Category', 'Message', 'Page', 'Status'],
			...feedback.map(f => [
				new Date(f.created_at).toLocaleDateString(),
				f.user_email || '',
				f.rating?.toString() || '',
				f.category,
				f.message || '',
				f.page_context,
				f.status,
			]),
		]
			.map(row => row.join(','))
			.join('\n');

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `feedback-${new Date().toISOString().split('T')[0]}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-lg">Loading feedback...</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Stats Overview */}
			{stats && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
					<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm p-4">
						<div className="text-sm text-muted dark:text-gray-400 mb-1">Total Feedback</div>
						<div className="text-2xl text-foreground dark:text-gray-100">{stats.total}</div>
					</div>
					<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm p-4">
						<div className="text-sm text-yellow-700 dark:text-yellow-400 mb-1">New</div>
						<div className="text-2xl text-yellow-800 dark:text-yellow-300">{stats.new}</div>
					</div>
					<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-sm p-4">
						<div className="text-sm text-blue-700 dark:text-blue-400 mb-1">Reviewed</div>
						<div className="text-2xl text-blue-800 dark:text-blue-300">{stats.reviewed}</div>
					</div>
					<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-sm p-4">
						<div className="text-sm text-green-700 dark:text-green-400 mb-1">Actioned</div>
						<div className="text-2xl text-green-800 dark:text-green-300">{stats.actioned}</div>
					</div>
					<div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-sm p-4">
						<div className="text-sm text-purple-700 dark:text-purple-400 mb-1">Avg Rating</div>
						<div className="text-2xl text-purple-800 dark:text-purple-300">
							{stats.averageRating ? `${stats.averageRating.toFixed(1)} ★` : 'N/A'}
						</div>
					</div>
				</div>
			)}

			{/* Filters */}
			<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm p-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
					<div>
						<label className="block text-sm font-medium text-muted dark:text-gray-400 mb-1">Status</label>
						<select
							value={selectedStatus}
							onChange={e => setSelectedStatus(e.target.value as FeedbackStatus | 'all')}
							className="w-full px-3 py-2 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-foreground dark:text-gray-100"
						>
							<option value="all">All</option>
							<option value="new">New</option>
							<option value="reviewed">Reviewed</option>
							<option value="actioned">Actioned</option>
							<option value="closed">Closed</option>
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium text-muted dark:text-gray-400 mb-1">Category</label>
						<select
							value={selectedCategory}
							onChange={e => setSelectedCategory(e.target.value as FeedbackCategory | 'all')}
							className="w-full px-3 py-2 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-foreground dark:text-gray-100"
						>
							<option value="all">All</option>
							<option value="general">General</option>
							<option value="bug">Bug Report</option>
							<option value="feature_request">Feature Request</option>
							<option value="praise">Praise</option>
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium text-muted dark:text-gray-400 mb-1">Rating</label>
						<select
							value={selectedRating}
							onChange={e => setSelectedRating(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
							className="w-full px-3 py-2 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-foreground dark:text-gray-100"
						>
							<option value="all">All</option>
							<option value="5">5 Stars</option>
							<option value="4">4 Stars</option>
							<option value="3">3 Stars</option>
							<option value="2">2 Stars</option>
							<option value="1">1 Star</option>
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium text-muted dark:text-gray-400 mb-1">From Date</label>
						<input
							type="date"
							value={dateRange.start}
							onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
							className="w-full px-3 py-2 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-foreground dark:text-gray-100"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-muted dark:text-gray-400 mb-1">To Date</label>
						<input
							type="date"
							value={dateRange.end}
							onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
							className="w-full px-3 py-2 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-foreground dark:text-gray-100"
						/>
					</div>
				</div>

				<div className="flex gap-3 mt-4">
					<button
						onClick={fetchFeedback}
						className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
					>
						Apply Filters
					</button>
					<button
						onClick={() => {
							setSelectedStatus('all');
							setSelectedCategory('all');
							setSelectedRating('all');
							setDateRange({ start: '', end: '' });
						}}
						className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-sm hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
					>
						Clear Filters
					</button>
					{feedback.length > 0 && (
						<button
							onClick={handleExport}
							className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-sm hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
						>
							Export CSV
						</button>
					)}
				</div>
			</div>

			{/* Feedback Table */}
			<FeedbackTable feedback={feedback} onStatusUpdate={handleStatusUpdate} />
		</div>
	);
}
