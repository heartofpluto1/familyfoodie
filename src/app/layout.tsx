import { auth } from '@/auth';
import './globals.css';
import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import HeaderLogo from './components/HeaderLogo';
import Footer from './components/Footer';
import { Providers } from './providers';
import FeedbackWidget from './feedback/FeedbackWidget';

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
	const session = await auth();

	return (
		<html lang="en">
			<body className={`${sourceSerif4.variable} antialiased min-h-screen flex flex-col`}>
				<Providers>
					<HeaderLogo session={session} />
					<main className="flex-grow flex flex-col">{children}</main>
					<Footer />
					<FeedbackWidget />
				</Providers>
			</body>
		</html>
	);
}
