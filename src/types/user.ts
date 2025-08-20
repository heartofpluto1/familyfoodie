export interface User {
	id: number;
	username: string;
	first_name: string;
	last_name: string;
	email: string;
	is_active: boolean;
	is_admin: boolean;
	date_joined: string;
	last_login: string | null;
}

export interface UserUpdate {
	first_name?: string;
	last_name?: string;
	email?: string;
	is_active?: boolean;
	is_admin?: boolean;
}
