import './globals.css';
import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import { getSession } from '@/lib/session';
import HeaderLogo from './components/HeaderLogo';
import { ToastProvider } from './components/ToastProvider';

const sourceSerif4 = Source_Serif_4({
	subsets: ['latin'],
	weight: ['400', '600', '700'],
	variable: '--font-heading',
	display: 'swap',
});

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
			<body className={`${sourceSerif4.variable} antialiased`}>
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
