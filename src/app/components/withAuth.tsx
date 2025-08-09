import { redirect } from 'next/navigation';
import { getEncryptedSession } from '@/lib/session';

export function withAuth<T = Record<string, unknown>>(WrappedComponent: (props: T) => Promise<React.ReactElement>) {
	return async function AuthenticatedComponent(props: T) {
		const session = await getEncryptedSession();
		if (!session) {
			redirect('login');
		}

		return await WrappedComponent(props);
	};
}

export default withAuth;
