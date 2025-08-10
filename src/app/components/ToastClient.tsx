'use client';

import { useEffect, useState } from 'react';
import { ToastErrorIcon, ToastWarningIcon, ToastSuccessIcon, ToastInfoIcon, CloseIcon } from './Icons';
import { ToastMessage } from '@/types/toast';

interface ToastProps {
	toast: ToastMessage;
	onRemove: (id: string) => void;
}

const Toast = ({ toast, onRemove }: ToastProps) => {
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(false);
			setTimeout(() => onRemove(toast.id), 300);
		}, 5000);

		return () => clearTimeout(timer);
	}, [toast.id, onRemove]);

	const getBackgroundColor = () => {
		switch (toast.type) {
			case 'error':
				return '#bd362f';
			case 'warning':
				return '#f89406';
			case 'success':
				return '#51a351';
			default:
				return '#2f96b4';
		}
	};

	const getIcon = () => {
		switch (toast.type) {
			case 'error':
				return <ToastErrorIcon />;
			case 'warning':
				return <ToastWarningIcon />;
			case 'success':
				return <ToastSuccessIcon />;
			default:
				return <ToastInfoIcon />;
		}
	};

	return (
		<div
			className={`relative w-80 mb-2 rounded-sm shadow-lg text-white transform transition-all duration-300 ease-out cursor-pointer hover:opacity-90 ${
				isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
			}`}
			style={{ backgroundColor: getBackgroundColor() }}
			onClick={() => {
				setIsVisible(false);
				setTimeout(() => onRemove(toast.id), 300);
			}}
		>
			<div className="flex items-center px-4 py-3">
				<div className="flex-shrink-0 mr-3">{getIcon()}</div>
				<div className="flex-1 min-w-0">
					<div className="text-base font-bold leading-tight">{toast.title}</div>
					<div className="text-sm opacity-90 leading-tight mt-1">{toast.message}</div>
				</div>
				<button
					className="ml-3 flex-shrink-0 text-white hover:text-gray-200 focus:outline-none"
					onClick={e => {
						e.stopPropagation();
						setIsVisible(false);
						setTimeout(() => onRemove(toast.id), 300);
					}}
				>
					<span className="sr-only">Close</span>
					<CloseIcon />
				</button>
			</div>
		</div>
	);
};

export default Toast;
