'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import ConfirmDialog from '@/app/components/ConfirmDialog';

interface Migration {
	version: string;
	status: 'completed' | 'pending';
	executed_at: string | null;
	execution_time_ms: number | null;
}

interface MigrationStatus {
	success: boolean;
	summary: {
		total: number;
		completed: number;
		pending: number;
		schema_migrations_exists: boolean;
	};
	migrations: Migration[];
	environment: string;
}

export default function MigrationsClient() {
	const { showToast } = useToast();
	const [status, setStatus] = useState<MigrationStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [showRunConfirm, setShowRunConfirm] = useState(false);
	const [retryCount, setRetryCount] = useState(0);
	const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);

	const fetchStatus = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch('/api/admin/migrations/status');

			if (!response.ok) {
				throw new Error('Failed to fetch migration status');
			}

			const data = await response.json();
			setStatus(data);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			setError(errorMessage);
			showToast('error', 'Error', errorMessage);
		} finally {
			setLoading(false);
		}
	}, [showToast]);

	const handleRunMigrationsClick = () => {
		setShowRunConfirm(true);
	};

	const handleRunMigrationsConfirm = async (retryAttempt = 0) => {
		setShowRunConfirm(false);
		try {
			setIsRunning(true);
			const response = await fetch('/api/admin/migrate', {
				method: 'POST',
			});

			if (response.status === 409) {
				// Migration already in progress - handle concurrent request
				// Future enhancement: could use error.context for lock details

				if (retryAttempt < 3) {
					// Auto-retry with exponential backoff
					const retryDelay = Math.pow(2, retryAttempt) * 2000; // 2s, 4s, 8s
					setRetryCount(retryAttempt + 1);

					showToast('info', 'Migration In Progress', `Another migration is running. Retrying in ${retryDelay / 1000} seconds... (${retryAttempt + 1}/3)`);

					const timeout = setTimeout(() => {
						handleRunMigrationsConfirm(retryAttempt + 1);
					}, retryDelay);

					setRetryTimeout(timeout);
					return;
				} else {
					// Max retries exceeded
					showToast(
						'warning',
						'Migration Busy',
						'Migration is still running after multiple attempts. Please try again later or check with your administrator.'
					);
					return;
				}
			}

			if (!response.ok) {
				const error = await response.json();

				// Enhanced error messaging with detailed context
				const errorMessage = error.error || 'Failed to run migrations';
				let errorDetails = '';

				if (error.errorCode) {
					errorDetails = `Error Code: ${error.errorCode}`;
				}

				if (error.nextSteps) {
					errorDetails += errorDetails ? `\n${error.nextSteps}` : error.nextSteps;
				}

				// Show detailed error if available, fallback to generic message
				const displayMessage = errorDetails ? `${errorMessage}\n\n${errorDetails}` : errorMessage;
				throw new Error(displayMessage);
			}

			const result = await response.json();
			showToast('success', 'Success', result.message);

			// Reset retry count on success
			setRetryCount(0);

			// Refresh the status
			await fetchStatus();
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			showToast('error', 'Error', errorMessage);
		} finally {
			setIsRunning(false);
			setRetryCount(0);
			if (retryTimeout) {
				clearTimeout(retryTimeout);
				setRetryTimeout(null);
			}
		}
	};

	const handleRunMigrationsCancel = () => {
		setShowRunConfirm(false);
	};

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (retryTimeout) {
				clearTimeout(retryTimeout);
			}
		};
	}, [retryTimeout]);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-lg">Loading migration status...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm p-4">
				<h3 className="text-red-800 dark:text-red-400 font-semibold mb-2">Error Loading Migration Status</h3>
				<p className="text-red-600 dark:text-red-300">{error}</p>
				<button
					onClick={fetchStatus}
					className="mt-4 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-sm hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
				>
					Retry
				</button>
			</div>
		);
	}

	if (!status) {
		return null;
	}

	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm p-4">
					<div className="text-sm text-muted dark:text-gray-400 mb-1">Environment</div>
					<div className="text-2xl font-semibold capitalize text-foreground dark:text-gray-100">{status.environment}</div>
				</div>
				<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm p-4">
					<div className="text-sm text-muted dark:text-gray-400 mb-1">Total Migrations</div>
					<div className="text-2xl font-semibold text-foreground dark:text-gray-100">{status.summary.total}</div>
				</div>
				<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-sm shadow-sm p-4">
					<div className="text-sm text-green-700 dark:text-green-400 mb-1">Completed</div>
					<div className="text-2xl font-semibold text-green-800 dark:text-green-300">{status.summary.completed}</div>
				</div>
				<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm shadow-sm p-4">
					<div className="text-sm text-yellow-700 dark:text-yellow-400 mb-1">Pending</div>
					<div className="text-2xl font-semibold text-yellow-800 dark:text-yellow-300">{status.summary.pending}</div>
				</div>
			</div>

			{/* Schema Migrations Table Status */}
			{!status.summary.schema_migrations_exists && (
				<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm p-4">
					<p className="text-yellow-800 dark:text-yellow-300">⚠️ The schema_migrations table does not exist yet. Run migrations to create it.</p>
				</div>
			)}

			{/* Action Buttons */}
			<div className="flex gap-4">
				<button
					onClick={fetchStatus}
					className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
				>
					Refresh Status
				</button>
				{status.summary.pending > 0 && (
					<button
						onClick={handleRunMigrationsClick}
						disabled={isRunning}
						className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-sm hover:bg-green-700 dark:hover:bg-green-600 transition-colors disabled:opacity-50"
					>
						{isRunning
							? retryCount > 0
								? `Retrying Migration... (${retryCount}/3)`
								: 'Running Migrations...'
							: `Run ${status.summary.pending} Pending Migration${status.summary.pending > 1 ? 's' : ''}`}
					</button>
				)}
			</div>

			{/* Migrations Table */}
			<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm overflow-hidden">
				<div className="px-6 py-4 border-b border-custom dark:border-gray-700">
					<h2 className="text-lg font-semibold text-foreground dark:text-gray-100">Migration History</h2>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-custom dark:border-gray-700">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Status</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Version</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Executed At</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Execution Time</th>
							</tr>
						</thead>
						<tbody className="bg-white dark:bg-gray-800 divide-y divide-light dark:divide-gray-700">
							{status.migrations.map(migration => (
								<tr key={migration.version}>
									<td className="px-6 py-4 whitespace-nowrap">
										{migration.status === 'completed' ? (
											<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
												✓ Completed
											</span>
										) : (
											<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
												⏳ Pending
											</span>
										)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground dark:text-gray-200">{migration.version}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-gray-400">
										{migration.executed_at ? new Date(migration.executed_at).toLocaleString() : '-'}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-gray-400">
										{migration.execution_time_ms !== null ? `${migration.execution_time_ms}ms` : '-'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Run Migrations Confirmation Dialog */}
			<ConfirmDialog
				isOpen={showRunConfirm}
				title="Run Pending Migrations"
				message="Are you sure you want to run pending migrations? This action cannot be undone."
				confirmText="Run Migrations"
				cancelText="Cancel"
				onConfirm={handleRunMigrationsConfirm}
				onCancel={handleRunMigrationsCancel}
				isLoading={false}
			/>
		</div>
	);
}
