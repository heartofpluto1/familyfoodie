import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import HeaderLogo from './components/HeaderLogo';

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
				<AuthProvider>
					<HeaderLogo />
					{children}
				</AuthProvider>
			</body>
		</html>
	);
}
