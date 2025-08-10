import './globals.css';
import type { Metadata } from 'next';
import { getSession } from '@/lib/session';
import HeaderLogo from './components/HeaderLogo';
import { ToastProvider } from './components/ToastProvider';

export const metadata: Metadata = {
	title: 'Family Foodie',
	description: 'Shift left on meal planning and shopping lists',
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// Get session server-side for header
	const session = await getSession();

	return (
		<html lang="en">
			<body className={`antialiased`}>
				<ToastProvider>
					<HeaderLogo session={session} />
					{children}
				</ToastProvider>
			</body>
		</html>
	);
}

// Force dynamic rendering for session checks
export const dynamic = 'force-dynamic';
