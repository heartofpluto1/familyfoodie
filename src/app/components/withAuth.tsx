import { redirect } from 'next/navigation';
import { getEncryptedSession } from '@/lib/session';
import { ReactNode } from 'react';

// Generic page component type that works with Next.js 15.5
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageComponent<P = any> = (props: P) => Promise<ReactNode> | ReactNode;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAuth<P = any>(WrappedComponent: PageComponent<P>): PageComponent<P> {
	return async function AuthenticatedComponent(props: P): Promise<ReactNode> {
		const session = await getEncryptedSession();
		if (!session) {
			redirect('login');
		}

		const result = await WrappedComponent(props);
		return result;
	};
}

export default withAuth;
