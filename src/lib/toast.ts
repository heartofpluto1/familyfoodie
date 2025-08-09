// Global toast utility for server-side components
// This allows server components to queue toast messages that will be displayed on the client

let pendingToasts: Array<{
	type: 'info' | 'error' | 'warning' | 'success';
	title: string;
	message: string;
}> = [];

export function addToast(type: 'info' | 'error' | 'warning' | 'success', title: string, message: string) {
	pendingToasts.push({ type, title, message });
}

export function getPendingToasts() {
	const toasts = [...pendingToasts];
	pendingToasts = []; // Clear after getting
	return toasts;
}

export function clearPendingToasts() {
	pendingToasts = [];
}
