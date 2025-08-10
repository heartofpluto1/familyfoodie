export const LinkIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<polyline points="15,3 21,3 21,9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<line x1="10" y1="14" x2="21" y2="3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const DeleteIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<line x1="18" y1="6" x2="6" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<line x1="6" y1="6" x2="18" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const DragHandleIcon = ({ className = 'w-3 h-6' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 12 24" fill="currentColor">
		<circle cx="3" cy="4" r="1.5" />
		<circle cx="3" cy="12" r="1.5" />
		<circle cx="3" cy="20" r="1.5" />
		<circle cx="9" cy="4" r="1.5" />
		<circle cx="9" cy="12" r="1.5" />
		<circle cx="9" cy="20" r="1.5" />
	</svg>
);
