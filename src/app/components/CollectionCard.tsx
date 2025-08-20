'use client';

interface CollectionCardProps {
	coverImage: string;
	title?: string;
	subtitle?: string;
	subscribed: boolean;
}

const CollectionCard = ({ coverImage, subscribed, title, subtitle }: CollectionCardProps) => {
	// Peek card configurations
	const peekCards = [
		{ height: '380px', top: '10px', rotation: 3.6 },
		{ height: '400px', top: '5px', rotation: 1.2 },
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
		<div className="relative mt-1 w-[300px] h-[410px]">
			{/* Render peek cards */}
			{peekCards.map((card, index) => (
				<div
					key={index}
					className="absolute rounded-sm w-[280px] transition-transform duration-500 ease-out z-0"
					style={{
						height: card.height,
						top: card.top,
						right: '-3px',
						transform: `rotate(${card.rotation}deg)`,
						backgroundColor: 'white',
						boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.22)',
					}}
				/>
			))}

			{/* Main collection card - positioned in front */}
			<div className="relative w-full h-[410px] z-10">
				<article
					className="relative border-custom rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-400 w-full h-full flex flex-col bg-black bg-cover bg-center text-black"
					style={{
						backgroundImage: `url("${coverImage}")`,
						boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.22)',
					}}
				>
					<div
						className="w-full h-full flex flex-col relative"
						style={{ background: 'radial-gradient(circle at var(--mouse-x) var(--mouse-y), transparent 0, rgba(0, 0, 0, 0.8) 150px)' }}
					>
						<div className="p-12 pt-25 flex flex-col flex-grow">
							<h3 className="text-lg font-bold text-center" style={{ lineHeight: '1.3' }}>
								{title && formatTitle(title)}
							</h3>
							<p className="pt-2 text-xs text-center">{subtitle}</p>
						</div>

						{/* Subscribe button */}
						{!subscribed && (
							<button
								className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-sm text-sm font-semibold hover:bg-blue-700 transition-colors"
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

export default CollectionCard;
