// Primary user interface with household context
export interface SessionUser {
	id: number;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	is_admin: boolean;
	is_active: boolean;
	household_id: number;
	household_name: string;
}

// Session structure returned by getSession()
export interface Session {
	user: Omit<SessionUser, 'household_id' | 'household_name'>;
	household_id: number;
	household_name: string;
	loginTime: number;
}
