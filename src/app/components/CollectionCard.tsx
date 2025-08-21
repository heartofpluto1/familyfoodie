'use client';

interface CollectionCardProps {
	coverImage: string;
	darkCoverImage?: string;
	title?: string;
	subtitle?: string;
	subscribed: boolean;
	recipeCount?: number;
}

const CollectionCard = ({ coverImage, darkCoverImage, subscribed, title, subtitle, recipeCount }: CollectionCardProps) => {
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
		<div className="relative mt-1 w-[296px] h-[410px]">
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
						backgroundColor: 'var(--peek-card-bg)',
						boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.22)',
					}}
				/>
			))}

			{/* Main collection card - positioned in front */}
			<div className="relative w-full h-[410px] z-10">
				<article
					className="relative rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-400 w-full h-full flex flex-col bg-black text-black"
					style={{
						boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.22)',
					}}
				>
					{/* Image with dark mode support using semantic picture element */}
					<picture className="absolute inset-0 w-full h-full">
						{darkCoverImage && <source media="(prefers-color-scheme: dark)" srcSet={darkCoverImage} />}
						<img src={coverImage} alt="Collection cover" className="w-full h-full object-cover" />
					</picture>

					<div
						className="w-full h-full flex flex-col relative z-10"
						style={{ background: 'radial-gradient(circle at var(--mouse-x) var(--mouse-y), transparent 0, rgba(0, 0, 0, 0.8) 150px)' }}
					>
						<div className="p-12 pt-25 flex flex-col flex-grow">
							<h3 className="text-lg font-bold text-center" style={{ lineHeight: '1.3', display: 'none' }}>
								{title && formatTitle(title)}
							</h3>
							<p className="pt-2 text-xs text-center" style={{ display: 'none' }}>
								{subtitle}
							</p>
						</div>

						{/* Recipe count badge - triangle pointing to top-left */}
						{recipeCount !== undefined && (
							<div
								className="absolute bottom-0 right-0 bg-white bg-opacity-90 text-black dark:bg-black dark:bg-opacity-60 dark:text-white flex items-end justify-end text-xs font-medium"
								style={{
									width: '48px',
									height: '48px',
									clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)',
									paddingBottom: '4px',
									paddingRight: '4px',
								}}
							>
								{recipeCount}
							</div>
						)}

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
