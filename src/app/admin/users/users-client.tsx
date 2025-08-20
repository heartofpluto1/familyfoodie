'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import type { User } from '@/types/user';

interface UserStats {
	total: number;
	active: number;
	admins: number;
}

interface CurrentUser {
	id: number;
	username: string;
	email: string;
	is_admin: boolean;
}

export default function UsersClient() {
	const { showToast } = useToast();
	const [users, setUsers] = useState<User[]>([]);
	const [stats, setStats] = useState<UserStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [editingUser, setEditingUser] = useState<number | null>(null);
	const [editForm, setEditForm] = useState<Partial<User>>({});
	const [searchTerm, setSearchTerm] = useState('');
	const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

	const fetchCurrentUser = async () => {
		try {
			const response = await fetch('/api/auth/session');
			if (response.ok) {
				const data = await response.json();
				setCurrentUser(data.user);
			}
		} catch (error) {
			console.error('Failed to fetch current user:', error);
		}
	};

	const fetchUsers = useCallback(async () => {
		try {
			setLoading(true);
			const response = await fetch('/api/admin/users?includeStats=true');

			if (!response.ok) {
				throw new Error('Failed to fetch users');
			}

			const data = await response.json();
			setUsers(data.users);
			setStats(data.stats);
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to load users');
		} finally {
			setLoading(false);
		}
	}, [showToast]);

	useEffect(() => {
		fetchCurrentUser();
		fetchUsers();
	}, [fetchUsers]);

	const handleEdit = (user: User) => {
		setEditingUser(user.id);
		setEditForm({
			first_name: user.first_name,
			last_name: user.last_name,
			email: user.email,
			is_active: user.is_active,
			is_admin: user.is_admin,
		});
	};

	const handleCancelEdit = () => {
		setEditingUser(null);
		setEditForm({});
	};

	const handleSaveEdit = async (userId: number) => {
		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(editForm),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to update user');
			}

			showToast('success', 'Success', 'User updated successfully');
			setEditingUser(null);
			setEditForm({});
			fetchUsers();
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to update user');
		}
	};

	const handleDelete = async (userId: number, username: string) => {
		if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
			return;
		}

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'DELETE',
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to delete user');
			}

			showToast('success', 'Success', 'User deleted successfully');
			fetchUsers();
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to delete user');
		}
	};

	const filteredUsers = users.filter(
		user =>
			user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
			user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
			user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
	);

	if (loading) {
		return (
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="text-center py-12">Loading users...</div>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-semibold text-foreground dark:text-gray-100 mb-2">User Management</h1>
				<p className="text-muted dark:text-gray-400">Manage FamilyFoodie user accounts and permissions</p>
			</div>

			{/* Stats Cards */}
			{stats && (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
					<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm p-4">
						<div className="text-sm text-muted dark:text-gray-400 mb-1">Total Users</div>
						<div className="text-2xl font-semibold text-foreground dark:text-gray-100">{stats.total}</div>
					</div>
					<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-sm p-4">
						<div className="text-sm text-green-700 dark:text-green-400 mb-1">Active Users</div>
						<div className="text-2xl font-semibold text-green-800 dark:text-green-300">{stats.active}</div>
					</div>
					<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-sm p-4">
						<div className="text-sm text-blue-700 dark:text-blue-400 mb-1">Admins</div>
						<div className="text-2xl font-semibold text-blue-800 dark:text-blue-300">{stats.admins}</div>
					</div>
				</div>
			)}

			{/* Search Bar */}
			<div className="mb-6">
				<input
					type="text"
					placeholder="Search users by name, username, or email..."
					value={searchTerm}
					onChange={e => setSearchTerm(e.target.value)}
					className="w-full px-4 py-2 border border-custom dark:border-gray-700 rounded-sm bg-surface dark:bg-gray-800 text-foreground dark:text-gray-100 placeholder-muted dark:placeholder-gray-400"
				/>
			</div>

			{/* Users Table */}
			<div className="bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-custom dark:border-gray-700">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">User</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Email</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Status</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Permissions</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Joined</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-gray-400 uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody className="bg-white dark:bg-gray-800 divide-y divide-light dark:divide-gray-700">
							{filteredUsers.map(user => (
								<tr key={user.id}>
									<td className="px-6 py-4 whitespace-nowrap">
										<div>
											<div className="text-sm font-medium text-foreground dark:text-gray-200">
												{editingUser === user.id ? (
													<div className="space-y-2">
														<input
															type="text"
															value={editForm.first_name || ''}
															onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
															className="px-2 py-1 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-sm"
															placeholder="First name"
														/>
														<input
															type="text"
															value={editForm.last_name || ''}
															onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
															className="px-2 py-1 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-sm"
															placeholder="Last name"
														/>
													</div>
												) : (
													`${user.first_name} ${user.last_name}`.trim() || user.username
												)}
											</div>
											<div className="text-sm text-muted dark:text-gray-400">@{user.username}</div>
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										{editingUser === user.id ? (
											<input
												type="email"
												value={editForm.email || ''}
												onChange={e => setEditForm({ ...editForm, email: e.target.value })}
												className="px-2 py-1 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-sm"
											/>
										) : (
											<div className="text-sm text-foreground dark:text-gray-300">{user.email}</div>
										)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										{editingUser === user.id ? (
											<label className="flex items-center">
												<input
													type="checkbox"
													checked={editForm.is_active}
													onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
													className="mr-2"
												/>
												<span className="text-sm">Active</span>
											</label>
										) : (
											<span
												className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
													user.is_active
														? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
														: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'
												}`}
											>
												{user.is_active ? 'Active' : 'Inactive'}
											</span>
										)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										{editingUser === user.id ? (
											<div className="space-y-1">
												<label className="flex items-center">
													<input
														type="checkbox"
														checked={editForm.is_admin}
														onChange={e => setEditForm({ ...editForm, is_admin: e.target.checked })}
														className="mr-2"
														disabled={user.id === currentUser?.id}
													/>
													<span className="text-sm">Admin</span>
												</label>
											</div>
										) : (
											<div className="space-x-2">
												{user.is_admin ? (
													<span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
														Admin
													</span>
												) : (
													<span className="text-sm text-muted dark:text-gray-400">User</span>
												)}
											</div>
										)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-gray-400">
										{new Date(user.date_joined).toLocaleDateString()}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										{editingUser === user.id ? (
											<div className="space-x-2">
												<button
													onClick={() => handleSaveEdit(user.id)}
													className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
												>
													Save
												</button>
												<button
													onClick={handleCancelEdit}
													className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
												>
													Cancel
												</button>
											</div>
										) : (
											<div className="space-x-2">
												<button
													onClick={() => handleEdit(user)}
													className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
												>
													Edit
												</button>
												{user.id !== currentUser?.id && (
													<button
														onClick={() => handleDelete(user.id, user.username)}
														className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
													>
														Delete
													</button>
												)}
											</div>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
