import './globals.css';
import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import HeaderLogo from './components/HeaderLogo';
import { ToastProvider } from './components/ToastProvider';
import { Providers } from './providers';

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

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${sourceSerif4.variable} antialiased`}>
				<Providers>
					<ToastProvider>
						<HeaderLogo />
						{children}
					</ToastProvider>
				</Providers>
			</body>
		</html>
	);
}
