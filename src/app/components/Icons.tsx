interface IconProps {
	className?: string;
}

export const LinkIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<polyline points="15,3 21,3 21,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const DeleteIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const TrashIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<path
			d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const ChevronUpIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const ChevronDownIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const ChevronLeftIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const DragHandleIcon = ({ className = 'w-2 h-6' }: IconProps) => (
	<svg className={className} viewBox="0 0 6 24" fill="currentColor">
		<circle cx="3" cy="4" r="1.5" />
		<circle cx="3" cy="12" r="1.5" />
		<circle cx="3" cy="20" r="1.5" />
	</svg>
);

export const CloseIcon = ({ className = 'h-5 w-5' }: IconProps) => (
	<svg className={className} viewBox="0 0 20 20" fill="currentColor">
		<path
			fillRule="evenodd"
			d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
			clipRule="evenodd"
		/>
	</svg>
);

export const ToastErrorIcon = ({ className = 'h-7 w-7 text-white' }: IconProps) => (
	<svg className={className} fill="currentColor" viewBox="0 0 20 20">
		<path
			fillRule="evenodd"
			d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
			clipRule="evenodd"
		/>
	</svg>
);

export const ToastWarningIcon = ({ className = 'h-7 w-7 text-white' }: IconProps) => (
	<svg className={className} fill="currentColor" viewBox="0 0 20 20">
		<path
			fillRule="evenodd"
			d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
			clipRule="evenodd"
		/>
	</svg>
);

export const ToastSuccessIcon = ({ className = 'h-7 w-7 text-white' }: IconProps) => (
	<svg className={className} fill="currentColor" viewBox="0 0 20 20">
		<path
			fillRule="evenodd"
			d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
			clipRule="evenodd"
		/>
	</svg>
);

export const ToastInfoIcon = ({ className = 'h-7 w-7 text-white' }: IconProps) => (
	<svg className={className} fill="currentColor" viewBox="0 0 20 20">
		<path
			fillRule="evenodd"
			d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
			clipRule="evenodd"
		/>
	</svg>
);

export const PlusIcon = ({ className = 'w-5 h-5' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
	</svg>
);

export const UploadIcon = ({ className = 'w-5 h-5' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
		/>
	</svg>
);

export const SwapIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
		/>
	</svg>
);

export const RemoveIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
	</svg>
);

export const TimeIcon = ({ className = 'w-4 h-4 mr-1' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<circle cx="12" cy="12" r="10" />
		<polyline points="12,6 12,12 16,14" />
	</svg>
);

export const DownloadIcon = ({ className = 'w-5 h-5 mr-2' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
		/>
	</svg>
);

export const LogoutIcon = ({ className = 'w-5 h-5' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
		/>
	</svg>
);

export const SearchIcon = ({ className = 'h-5 w-5 text-muted' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
	</svg>
);

export const IntroPlanIcon = ({ className = 'w-8 h-8' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
		/>
	</svg>
);

export const IntroStatsIcon = ({ className = 'w-8 h-8' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
		/>
	</svg>
);

export const IntroShoppingCartIcon = ({ className = 'w-8 h-8' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6m0 0h16M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z"
		/>
	</svg>
);

export const ErrorIconSmall = ({ className = 'w-5 h-5 text-red-400 mr-2' }: IconProps) => (
	<svg className={className} fill="currentColor" viewBox="0 0 20 20">
		<path
			fillRule="evenodd"
			d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
			clipRule="evenodd"
		/>
	</svg>
);

export const BurgerIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
	</svg>
);

export const CheckIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
	</svg>
);

export const EditIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
		/>
	</svg>
);

export const SaveIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
		/>
	</svg>
);

export const SparklesIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M5 3l1.5 1.5L5 6l-1.5-1.5L5 3zm7 7l1.5 1.5L12 13l-1.5-1.5L12 10zm7-7l1.5 1.5L18 6l-1.5-1.5L18 3zM5.5 17.5L7 16l1.5 1.5L7 19l-1.5-1.5zm11 0L18 16l1.5 1.5L18 19l-1.5-1.5z"
		/>
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M2 12h20" />
	</svg>
);

export const RefreshIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 4v6h-6M1 20v-6h6" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.51 9A9 9 0 0118.36 5.64L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
	</svg>
);

export const CancelIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
	</svg>
);

export const CursorClickIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
		/>
	</svg>
);

export const CheckCircleIcon = ({ className = 'w-6 h-6' }: IconProps) => (
	<svg className={className} fill="currentColor" viewBox="0 0 24 24">
		<path
			fillRule="evenodd"
			d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
			clipRule="evenodd"
		/>
	</svg>
);

export const CopyIcon = ({ className = 'w-4 h-4' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
		/>
	</svg>
);

export const BookmarkIcon = ({ className = 'w-5 h-5' }: IconProps) => (
	<svg className={className} fill="currentColor" viewBox="0 0 24 24">
		<path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
	</svg>
);

export const BookmarkOutlineIcon = ({ className = 'w-5 h-5' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
	</svg>
);

export const BookStackIcon = ({ className = 'w-16 h-16' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={1.5}
			d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
		/>
	</svg>
);

export const FeedbackIcon = ({ className = 'w-6 h-6' }: IconProps) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
		/>
	</svg>
);
