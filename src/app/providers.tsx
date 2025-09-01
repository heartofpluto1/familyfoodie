'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from './components/ToastProvider';
import { FeedbackProvider } from './feedback/FeedbackProvider';

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<SessionProvider>
			<ToastProvider>
				<FeedbackProvider>{children}</FeedbackProvider>
			</ToastProvider>
		</SessionProvider>
	);
}
