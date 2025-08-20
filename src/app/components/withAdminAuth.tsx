import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getAuthenticatedUserFromSession } from '@/lib/auth-helpers';
import { JSX } from 'react';

// Simple, extensible type for Next.js page components
type NextPageComponent = (props: never) => Promise<JSX.Element> | JSX.Element;

export function withAdminAuth(WrappedComponent: NextPageComponent): NextPageComponent {
	return async function AdminAuthenticatedComponent(props: never): Promise<JSX.Element> {
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
