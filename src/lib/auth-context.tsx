'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
	username: string;
	userId?: string;
	loginTime?: number;
}

interface AuthContextType {
	user: User | null;
	isAuthenticated: boolean;
	loading: boolean;
	login: (userData: User) => void;
	logout: () => void;
	checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	const isAuthenticated = !!user;

	// Function to check session from API
	const checkSession = async () => {
		try {
			const response = await fetch('/api/auth/session');
			const data = await response.json();

			if (data.success && data.user) {
				setUser(data.user);
			} else {
				setUser(null);
			}
		} catch (error) {
			console.error('Session check failed:', error);
			setUser(null);
		} finally {
			setLoading(false);
		}
	};

	// Login function
	const login = (userData: User) => {
		setUser(userData);
	};

	// Logout function
	const logout = () => {
		setUser(null);
	};

	// Check session on mount
	useEffect(() => {
		checkSession();
	}, []);

	// Listen for authentication events
	useEffect(() => {
		const handleLogin = () => {
			checkSession();
		};

		const handleLogout = () => {
			logout();
		};

		// Listen for custom events
		window.addEventListener('userLogin', handleLogin);
		window.addEventListener('userLogout', handleLogout);

		return () => {
			window.removeEventListener('userLogin', handleLogin);
			window.removeEventListener('userLogout', handleLogout);
		};
	}, []);

	const value = {
		user,
		isAuthenticated,
		loading,
		login,
		logout,
		checkSession,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
