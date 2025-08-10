export interface ToastData {
	type: 'info' | 'error' | 'warning' | 'success';
	title: string;
	message: string;
}

export interface ToastMessage extends ToastData {
	id: string;
}
