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
