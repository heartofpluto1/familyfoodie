import Link from 'next/link';
import { Crimson_Text } from 'next/font/google';

const crimsonText = Crimson_Text({
	subsets: ['latin'],
	weight: ['400', '600', '700'],
	display: 'swap',
});

const HeaderLogo = () => {
	return (
		<header className="bg-surface border-b border-custom">
			<div className="container mx-auto px-4 py-4">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between">
					{/* Title Section */}
					<div className="mb-3 md:mb-0">
						<h1 className={`${crimsonText.className} font-bold text-2xl md:text-3xl text-foreground tracking-wide`}>Family Foodie</h1>
						<p className="text-sm text-muted italic">What the fork is for dinner?</p>
					</div>

					{/* Navigation */}
					<nav>
						<div className="flex space-x-4 md:space-x-6">
							<Link href="/" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline">
								Home
							</Link>
							<Link href="/#" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline">
								Shop
							</Link>
							<Link href="/#" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline">
								Recipes
							</Link>
							<Link href="/#" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline">
								Ingredients
							</Link>
						</div>
					</nav>
				</div>
			</div>
		</header>
	);
};

export default HeaderLogo;
