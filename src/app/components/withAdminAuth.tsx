import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getAuthenticatedUserFromSession } from '@/lib/auth-helpers';
import { ReactNode } from 'react';

// Generic page component type that works with Next.js 15.5
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageComponent<P = any> = (props: P) => Promise<ReactNode> | ReactNode;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAdminAuth<P = any>(WrappedComponent: PageComponent<P>): PageComponent<P> {
	return async function AdminAuthenticatedComponent(props: P): Promise<ReactNode> {
		const session = await getSession();
		if (!session) {
			redirect('login');
		}

		const user = await getAuthenticatedUserFromSession(session);
		if (!user || !user.is_admin) {
			redirect('/');
		}

		const result = await WrappedComponent(props);
		return result;
	};
}

export default withAdminAuth;
