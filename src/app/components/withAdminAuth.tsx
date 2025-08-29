import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { ReactNode } from 'react';

// Next.js page props interface for parameterized routes
interface PageProps {
	params?: Promise<Record<string, string | string[]>>;
	searchParams?: Promise<Record<string, string | string[]>>;
}

// Page component type that works with Next.js 15.5 App Router
type PageComponent<P = PageProps> = (props: P) => Promise<ReactNode> | ReactNode;

export function withAdminAuth<P extends PageProps = PageProps>(WrappedComponent: PageComponent<P>): PageComponent<P> {
	return async function AdminAuthenticatedComponent(props: P): Promise<ReactNode> {
		const session = await getSession();
		if (!session) {
			redirect('login');
		}

		// Check if user is admin
		if (!session.user.is_admin) {
			redirect('/');
		}

		const result = await WrappedComponent(props);
		return result;
	};
}

export default withAdminAuth;
