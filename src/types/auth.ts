export interface AuthenticatedUser {
	id: number;
	username: string;
	email: string;
	is_admin: boolean;
	is_active: boolean;
}

// Extended user interface with household context for Agent 2 implementation
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

export interface SessionData {
	user: AuthenticatedUser;
	loginTime: number;
}

// Extended session data with household context
export interface HouseholdSessionData {
	user: SessionUser;
	loginTime: number;
}
