'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import HeaderPage from '@/app/components/HeaderPage';

interface MigrationSummary {
	totalRecipes: number;
	totalMigrated: number;
	totalSkipped: number;
	totalErrors: number;
	storageMode: string;
}

interface PreviewSummary {
	totalRecipes: number;
	needsMigration: number;
	alreadyMigrated: number;
	storageMode: string;
}

interface PreviewResult {
	recipeId: number;
	recipeName: string;
	currentFilename: string;
	newFilename: string;
	needsMigration: boolean;
}

interface PreviewResponse {
	success: boolean;
	summary: PreviewSummary;
	results: PreviewResult[];
	error?: string;
}

interface MigrationResult {
	recipeId: number;
	recipeName: string;
	oldFilename: string;
	newFilename: string;
	imageMigrated: boolean;
	pdfMigrated: boolean;
	imageUrl?: string;
	pdfUrl?: string;
	error?: string;
}

interface MigrationResponse {
	success: boolean;
	message: string;
	summary: MigrationSummary;
	results: MigrationResult[];
	error?: string;
}

export default function MigrateFilesPage() {
	const { showToast } = useToast();
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null);
	const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null);

	const loadPreview = useCallback(async () => {
		setIsLoadingPreview(true);
		try {
			const response = await fetch('/api/recipe/migrate-files/preview', {
				method: 'GET',
				credentials: 'include',
			});

			const result: PreviewResponse = await response.json();

			if (result.success) {
				setPreviewResult(result);
			} else {
				showToast('error', 'Preview Failed', result.error || 'Failed to load preview');
			}
		} catch (error) {
			console.error('Preview error:', error);
			showToast('error', 'Preview Failed', 'Network error loading preview');
		} finally {
			setIsLoadingPreview(false);
		}
	}, [showToast]);

	// Load preview on component mount
	useEffect(() => {
		loadPreview();
	}, [loadPreview]);

	const handleMigration = async () => {
		if (!confirm('Are you sure you want to migrate all recipe files? This will rename files and update URLs.')) {
			return;
		}

		setIsLoading(true);
		setMigrationResult(null);

		try {
			const response = await fetch('/api/recipe/migrate-files', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
			});

			const result: MigrationResponse = await response.json();

			if (result.success) {
				setMigrationResult(result);
				showToast('success', 'Migration Complete', result.message);
			} else {
				showToast('error', 'Migration Failed', result.error || 'Unknown error');
			}
		} catch (error) {
			console.error('Migration error:', error);
			showToast('error', 'Migration Failed', 'Network error during migration');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8 max-w-4xl">
				<HeaderPage title="Migrate Recipe Files" subtitle="Convert all recipe files to secure, non-guessable filenames" />

				{/* Preview Section */}
				<div className="bg-card dark:bg-card border border-border rounded-sm shadow-md p-6 mb-6">
					<div className="mb-4">
						<h2 className="text-lg font-semibold text-card-foreground mb-2">Migration Preview</h2>
						<p className="text-muted-foreground mb-4">
							Review which recipes need file migration before starting the process. Any filename that doesn&apos;t match the secure hash format
							(32-character hex) will be migrated.
						</p>
					</div>

					{isLoadingPreview ? (
						<div className="flex items-center gap-2 text-muted-foreground">
							<div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
							Loading preview...
						</div>
					) : previewResult ? (
						<div className="space-y-4">
							<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
								<div className="text-center p-3 bg-muted/50 dark:bg-muted/30 rounded">
									<div className="text-2xl font-bold text-card-foreground">{previewResult.summary.totalRecipes}</div>
									<div className="text-sm text-muted-foreground">Total Recipes</div>
								</div>
								<div className="text-center p-3 bg-orange-100 dark:bg-orange-900/30 rounded">
									<div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{previewResult.summary.needsMigration}</div>
									<div className="text-sm text-muted-foreground">Need Migration</div>
								</div>
								<div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded">
									<div className="text-2xl font-bold text-green-700 dark:text-green-400">{previewResult.summary.alreadyMigrated}</div>
									<div className="text-sm text-muted-foreground">Already Migrated</div>
								</div>
							</div>
							<div className="text-sm text-muted-foreground">
								<strong>Storage Mode:</strong> {previewResult.summary.storageMode}
							</div>
							<div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
								<strong>Migration includes:</strong> Files with formats like rid_123, temp_456, legacy names, or any filename that isn&apos;t a
								32-character secure hash.
							</div>
						</div>
					) : (
						<div className="text-destructive">Failed to load preview. Check that FILENAME_SECRET is configured.</div>
					)}
				</div>

				{/* Migration Section */}
				<div className="bg-card dark:bg-card border border-border rounded-sm shadow-md p-6 mb-6">
					<div className="mb-4">
						<h2 className="text-lg font-semibold text-card-foreground mb-2">Start Migration</h2>
						<p className="text-muted-foreground mb-4">
							This will convert all recipe files with insecure filenames to secure, non-guessable hash format. In production, files will also be moved to
							Google Cloud Storage.
						</p>
						<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mb-4">
							<p className="text-yellow-800 dark:text-yellow-200 text-sm">
								<strong>Warning:</strong> This operation will rename files and update URLs. Make sure you have backups before proceeding.
							</p>
						</div>
					</div>

					<div className="flex gap-3">
						<button
							onClick={handleMigration}
							disabled={isLoading || !previewResult || previewResult.summary.needsMigration === 0}
							className={`px-4 py-2 rounded font-medium transition-colors ${
								isLoading || !previewResult
									? 'bg-muted text-muted-foreground cursor-not-allowed'
									: previewResult.summary.needsMigration === 0
										? 'bg-muted text-muted-foreground cursor-not-allowed'
										: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50'
							}`}
						>
							{isLoading
								? 'Migrating...'
								: previewResult?.summary.needsMigration === 0
									? 'No Migration Needed'
									: `Migrate ${previewResult?.summary.needsMigration || 0} Recipes`}
						</button>

						<button
							onClick={loadPreview}
							disabled={isLoadingPreview || isLoading}
							className="px-4 py-2 rounded border border-border text-card-foreground font-medium hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
						>
							{isLoadingPreview ? 'Refreshing...' : 'Refresh Preview'}
						</button>
					</div>
				</div>

				{migrationResult && (
					<div className="bg-card dark:bg-card border border-border rounded-sm shadow-md p-6">
						<h3 className="text-lg font-semibold text-card-foreground mb-4">Migration Results</h3>

						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
							<div className="text-center p-3 bg-muted/50 dark:bg-muted/30 rounded">
								<div className="text-2xl font-bold text-card-foreground">{migrationResult.summary.totalRecipes}</div>
								<div className="text-sm text-muted-foreground">Total Recipes</div>
							</div>
							<div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded">
								<div className="text-2xl font-bold text-green-700 dark:text-green-400">{migrationResult.summary.totalMigrated}</div>
								<div className="text-sm text-muted-foreground">Migrated</div>
							</div>
							<div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded">
								<div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{migrationResult.summary.totalSkipped}</div>
								<div className="text-sm text-muted-foreground">Skipped</div>
							</div>
							<div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
								<div className="text-2xl font-bold text-red-700 dark:text-red-400">{migrationResult.summary.totalErrors}</div>
								<div className="text-sm text-muted-foreground">Errors</div>
							</div>
						</div>

						<div className="mb-4">
							<p className="text-sm text-muted-foreground">
								<strong>Storage Mode:</strong> {migrationResult.summary.storageMode}
							</p>
						</div>

						{migrationResult.results.length > 0 && (
							<div>
								<h4 className="font-medium text-card-foreground mb-2">Migration Details:</h4>
								<div className="max-h-96 overflow-y-auto border border-border rounded">
									<table className="w-full text-sm">
										<thead className="bg-muted/50 dark:bg-muted/30 sticky top-0">
											<tr>
												<th className="text-left p-2 border-b border-border text-card-foreground">Recipe</th>
												<th className="text-left p-2 border-b border-border text-card-foreground">Old Filename</th>
												<th className="text-left p-2 border-b border-border text-card-foreground">New Filename</th>
												<th className="text-center p-2 border-b border-border text-card-foreground">Image</th>
												<th className="text-center p-2 border-b border-border text-card-foreground">PDF</th>
												<th className="text-left p-2 border-b border-border text-card-foreground">Status</th>
											</tr>
										</thead>
										<tbody>
											{migrationResult.results.map(result => (
												<tr key={result.recipeId} className="border-b border-border hover:bg-muted/30">
													<td className="p-2">
														<div className="font-medium text-card-foreground">{result.recipeName}</div>
														<div className="text-xs text-muted-foreground">ID: {result.recipeId}</div>
													</td>
													<td className="p-2 font-mono text-xs text-muted-foreground">{result.oldFilename}</td>
													<td className="p-2 font-mono text-xs text-card-foreground">{result.newFilename}</td>
													<td className="p-2 text-center">
														{result.imageMigrated ? (
															<span className="text-green-600 dark:text-green-400">✓</span>
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</td>
													<td className="p-2 text-center">
														{result.pdfMigrated ? (
															<span className="text-green-600 dark:text-green-400">✓</span>
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</td>
													<td className="p-2">
														{result.error ? (
															<span className="text-red-600 dark:text-red-400 text-xs">{result.error}</span>
														) : (
															<span className="text-green-600 dark:text-green-400 text-xs">Success</span>
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								{migrationResult.results.length === 50 && (
									<p className="text-xs text-muted-foreground mt-2">Showing first 50 results. Check server logs for complete details.</p>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
