'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import Toast, { ToastMessage } from './ToastClient';

interface ToastContextType {
	showToast: (type: ToastMessage['type'], title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast must be used within a ToastProvider');
	}
	return context;
};

interface ToastProviderProps {
	children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
	const [toasts, setToasts] = useState<ToastMessage[]>([]);

	const showToast = useCallback((type: ToastMessage['type'], title: string, message: string) => {
		const id = Date.now().toString();
		const newToast: ToastMessage = {
			id,
			type,
			title,
			message,
		};

		setToasts(prev => [...prev, newToast]);
	}, []);

	const removeToast = useCallback((id: string) => {
		setToasts(prev => prev.filter(toast => toast.id !== id));
	}, []);

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}

			{/* Toast Container */}
			<div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
				{toasts.map((toast, index) => (
					<Toast key={index} toast={toast} onRemove={removeToast} />
				))}
			</div>
		</ToastContext.Provider>
	);
};

export default ToastProvider;
