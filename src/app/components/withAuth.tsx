import { redirect } from 'next/navigation';
import { getEncryptedSession } from '@/lib/session';
import { JSX } from 'react';

// Simple, extensible type for Next.js page components
type NextPageComponent = (props: never) => Promise<JSX.Element> | JSX.Element;

export function withAuth(WrappedComponent: NextPageComponent): NextPageComponent {
	return async function AuthenticatedComponent(props: never): Promise<JSX.Element> {
		const session = await getEncryptedSession();
		if (!session) {
			redirect('login');
		}

		const result = await WrappedComponent(props);
		return result;
	};
}

export default withAuth;
