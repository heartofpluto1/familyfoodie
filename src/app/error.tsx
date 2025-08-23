'use client';

interface ErrorProps {
	error: Error;
	reset: () => void;
}

export default function Error({ error }: ErrorProps) {
	const isDatabaseConnectionError = error.message?.includes('DATABASE_CONNECTION_FAILED');

	if (isDatabaseConnectionError) {
		return (
			<div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 120px)' }}>
				<div className="max-w-md w-full text-center">
					<div className="space-y-4">
						{/* Database icon */}
						<div className="flex justify-center mb-6">
							<svg className="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
								/>
							</svg>
						</div>
						<h1 className="text-2xl text-gray-900 dark:text-gray-100">Database Temporarily Unavailable</h1>
						<p className="text-gray-600 dark:text-gray-400">
							We&apos;re having trouble connecting to our database right now. This is likely a temporary issue.
						</p>
					</div>
				</div>
			</div>
		);
	}

	// Let all other errors bubble up with original technical details
	throw error;
}
