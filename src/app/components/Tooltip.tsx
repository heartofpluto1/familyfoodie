'use client';

interface TooltipProps {
	text: string;
	backgroundColor: string;
	forceHide?: boolean;
}

const Tooltip = ({ text, backgroundColor, forceHide = false }: TooltipProps) => {
	if (!text) return null;

	const opacityClass = forceHide ? 'opacity-0' : 'opacity-0 group-hover:opacity-100';

	return (
		<div
			className={`hidden sm:block absolute top-full left-0 mt-2 px-2 py-1 border border-custom rounded shadow-lg text-xs text-foreground ${opacityClass} transition-opacity duration-200 delay-300 pointer-events-none z-10 whitespace-nowrap`}
			style={{ backgroundColor }}
		>
			{text}
			<div className="absolute bottom-full left-2 border-4 border-transparent" style={{ borderBottomColor: backgroundColor }}></div>
		</div>
	);
};

export default Tooltip;
