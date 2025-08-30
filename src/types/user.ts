export interface User {
	id: number;
	email: string;
	first_name: string;
	last_name: string;
	oauth_provider: string;
	oauth_provider_id: string;
	is_active: boolean;
	is_admin: boolean;
	date_joined: string;
	last_session?: string | null;
}

export interface UserUpdate {
	first_name?: string;
	last_name?: string;
	email?: string;
	is_active?: boolean;
	is_admin?: boolean;
}
