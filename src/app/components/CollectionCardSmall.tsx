'use client';

interface CollectionCardSmallProps {
	coverImage: string;
	title?: string;
	subtitle?: string;
	subscribed: boolean;
}

const CollectionCardSmall = ({ coverImage, subscribed, title, subtitle }: CollectionCardSmallProps) => {
	// Peek card configurations (scaled down by half)
	const peekCards = [
		{ height: '190px', top: '5px', rotation: 3.6 },
		{ height: '200px', top: '2.5px', rotation: 1.2 },
	];

	// Convert newlines to <br> tags for title display
	const formatTitle = (title: string) => {
		// Handle both \n and \\n characters
		const lines = title.replace(/\\n/g, '\n').split('\n');
		return lines.map((line, index) => (
			<span key={index}>
				{line.trim()}
				{index < lines.length - 1 && <br />}
			</span>
		));
	};

	return (
		<div className="relative mt-1 w-[148px] h-[205px]">
			{/* Render peek cards */}
			{peekCards.map((card, index) => (
				<div
					key={index}
					className="absolute rounded-sm w-[140px] transition-transform duration-500 ease-out z-0"
					style={{
						height: card.height,
						top: card.top,
						right: '-1.5px',
						transform: `rotate(${card.rotation}deg)`,
						backgroundColor: 'var(--peek-card-bg)',
						boxShadow: '1px 1px 2.5px rgba(0, 0, 0, 0.22)',
					}}
				/>
			))}

			{/* Main collection card - positioned in front */}
			<div className="relative w-full h-[205px] z-10">
				<article
					className="relative rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-400 w-full h-full flex flex-col bg-black bg-cover bg-center text-black"
					style={{
						backgroundImage: `url("${coverImage}")`,
						boxShadow: '1px 1px 2.5px rgba(0, 0, 0, 0.22)',
					}}
				>
					<div
						className="w-full h-full flex flex-col relative"
						style={{ background: 'radial-gradient(circle at var(--mouse-x) var(--mouse-y), transparent 0, rgba(0, 0, 0, 0.8) 75px)' }}
					>
						<div className="p-6 pt-12 flex flex-col flex-grow">
							<h3 className="text-sm font-bold text-center" style={{ lineHeight: '1.3', display: 'none' }}>
								{title && formatTitle(title)}
							</h3>
							<p className="pt-1 text-xs text-center" style={{ display: 'none' }}>
								{subtitle}
							</p>
						</div>

						{/* Subscribe button (smaller) */}
						{!subscribed && (
							<button
								className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-sm text-xs font-semibold hover:bg-blue-700 transition-colors"
								onClick={e => {
									e.preventDefault();
									console.log(`Subscribed to: ${title}`);
								}}
							>
								Subscribe
							</button>
						)}
					</div>
				</article>
			</div>
		</div>
	);
};

export default CollectionCardSmall;
