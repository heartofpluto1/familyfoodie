'use client';

import { useEffect } from 'react';
import { useToast } from './ToastProvider';

interface ServerToastsProps {
	toasts: Array<{
		type: 'info' | 'error' | 'warning' | 'success';
		title: string;
		message: string;
	}>;
}

const ToastServer = ({ toasts }: ServerToastsProps) => {
	const { showToast } = useToast();

	useEffect(() => {
		toasts.forEach(toast => {
			showToast(toast.type, toast.title, toast.message);
		});
	}, [toasts, showToast]);

	return null; // This component doesn't render anything visible
};

export default ToastServer;
