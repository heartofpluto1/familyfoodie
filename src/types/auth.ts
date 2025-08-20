export interface AuthenticatedUser {
	id: number;
	username: string;
	email: string;
	is_admin: boolean;
	is_active: boolean;
}

export interface SessionData {
	user: AuthenticatedUser;
	loginTime: number;
}
