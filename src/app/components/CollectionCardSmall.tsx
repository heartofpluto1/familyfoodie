'use client';

import { BookmarkIcon, BookmarkOutlineIcon } from './Icons';

interface CollectionCardSmallProps {
	coverImage: string;
	darkCoverImage?: string;
	title?: string;
	subtitle?: string;
	subscribed: boolean;
	recipeCount?: number;
	onToggleSubscription?: () => void;
	isLoading?: boolean;
}

const CollectionCardSmall = ({
	coverImage,
	darkCoverImage,
	subscribed,
	title,
	subtitle,
	recipeCount,
	onToggleSubscription,
	isLoading,
}: CollectionCardSmallProps) => {
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
					className="relative rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-400 w-full h-full flex flex-col bg-white dark:bg-black text-black"
					style={{
						boxShadow: '1px 1px 2.5px rgba(0, 0, 0, 0.22)',
					}}
				>
					{/* Image with dark mode support using semantic picture element */}
					<picture className="absolute inset-0 w-full h-full">
						{darkCoverImage && <source media="(prefers-color-scheme: dark)" srcSet={darkCoverImage} />}
						<img
							src={coverImage}
							alt="Collection cover"
							className="w-full h-full object-cover"
							onError={e => {
								// Remove all source elements to prevent re-evaluation
								const picture = e.currentTarget.parentElement;
								if (picture && picture.tagName === 'PICTURE') {
									const sources = picture.querySelectorAll('source');
									sources.forEach(source => source.remove());
								}
								e.currentTarget.src = '/onerror_collection.png';
							}}
						/>
					</picture>

					{/* Texture overlay */}
					<picture className="absolute inset-0 w-full h-full pointer-events-none">
						<source media="(prefers-color-scheme: dark)" srcSet="/collection_overlay_dark_mode.png" />
						<img src="/collection_overlay_light_mode.png" alt="" className="w-full h-full object-cover" />
					</picture>

					<div
						className="w-full h-full flex flex-col relative z-10"
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

						{/* Subscribe/Unsubscribe bookmark button (smaller) */}
						{onToggleSubscription && (
							<button
								className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center disabled:opacity-50 transition-all hover:scale-110"
								onClick={e => {
									e.preventDefault();
									onToggleSubscription();
								}}
								disabled={isLoading}
								title={isLoading ? 'Loading...' : subscribed ? 'Unsubscribe' : 'Subscribe'}
							>
								{isLoading ? (
									<div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
								) : subscribed ? (
									<BookmarkIcon className="w-3 h-3 text-white" />
								) : (
									<BookmarkOutlineIcon className="w-3 h-3 text-white" />
								)}
							</button>
						)}
					</div>
				</article>
			</div>
		</div>
	);
};

export default CollectionCardSmall;
