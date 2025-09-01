'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from './components/ToastProvider';
import { FeedbackProvider } from './components/providers/FeedbackProvider';

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<SessionProvider>
			<ToastProvider>
				<FeedbackProvider>{children}</FeedbackProvider>
			</ToastProvider>
		</SessionProvider>
	);
}
