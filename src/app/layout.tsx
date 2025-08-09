import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import HeaderLogo from './components/HeaderLogo';
import { ToastProvider } from './components/ToastProvider';

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
			<body className={`antialiased`}>
				<ToastProvider>
					<AuthProvider>
						<HeaderLogo />
						{children}
					</AuthProvider>
				</ToastProvider>
			</body>
		</html>
	);
}
