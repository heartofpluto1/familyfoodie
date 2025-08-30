'use client';

import { useSession, signOut } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function Dashboard() {
	const { data: session, status } = useSession();

	if (status === 'loading') return <p>Loading...</p>;

	if (status === 'unauthenticated') {
		redirect('/auth/signin');
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-2xl font-bold mb-4">Welcome to your dashboard!</h1>
			<div className="bg-surface border border-custom rounded-sm p-6">
				<p className="mb-4">Hello, {session?.user?.name}!</p>
				<p className="mb-4">Email: {session?.user?.email}</p>
				<button onClick={() => signOut()} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
					Sign Out
				</button>
			</div>
		</div>
	);
}
