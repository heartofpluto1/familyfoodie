'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeDetail } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import HeaderPage from '@/app/components/HeaderPage';
import RecipeEditor from './components/RecipeEditor';

interface RecipeDetailsClientProps {
	recipe: RecipeDetail;
	collections: Collection[];
}

const RecipeDetailsClient = ({ recipe, collections }: RecipeDetailsClientProps) => {
	const router = useRouter();
	const [backLink, setBackLink] = useState<{ href: string; label: string } | null>(null);

	useEffect(() => {
		// Check if we can use browser history
		if (typeof window !== 'undefined' && document.referrer) {
			try {
				const referrerUrl = new URL(document.referrer);
				const currentUrl = new URL(window.location.href);

				// Only use referrer if it's from the same origin
				if (referrerUrl.origin === currentUrl.origin) {
					const path = referrerUrl.pathname;

					// Determine the label based on the path
					let label = 'Back';
					if (path === '/' || path === '/home') {
						label = 'Back to Home';
					} else if (path === '/plan' || path.startsWith('/plan/')) {
						label = 'Back to Meal Planner';
					} else if (path === '/shop' || path.startsWith('/shop/')) {
						label = 'Back to Shopping List';
					} else if (path === '/recipes') {
						label = 'Back to All Recipes';
					} else if (path.startsWith('/recipes/') && !path.includes(recipe.url_slug || '')) {
						// It's a collection page
						label = `Back to ${recipe.collection_title || 'Collection'}`;
					} else if (path === '/insights') {
						label = 'Back to Insights';
					}

					setBackLink({ href: path, label });
					return;
				}
			} catch {
				// Invalid referrer URL, fall back to default
			}
		}

		// Default fallback to collection
		if (recipe.collection_url_slug) {
			setBackLink({
				href: `/recipes/${recipe.collection_url_slug}`,
				label: `Back to ${recipe.collection_title || 'Collection'}`,
			});
		}
	}, [recipe]);

	// Generate a descriptive subtitle based on prep and cook times
	const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
	let subtitle = '';
	if (totalTime > 0) {
		const hours = Math.floor(totalTime / 60);
		const minutes = totalTime % 60;
		if (hours > 0 && minutes > 0) {
			subtitle = `${hours}h ${minutes}min`;
		} else if (hours > 0) {
			subtitle = `${hours} hour${hours > 1 ? 's' : ''}`;
		} else {
			subtitle = `${minutes} minutes`;
		}
		subtitle = `Ready in ${subtitle}`;
	}

	const handleBackClick = (e: React.MouseEvent) => {
		e.preventDefault();
		// Try to use browser back if we have history
		if (window.history.length > 1) {
			router.back();
		} else if (backLink) {
			// Otherwise navigate to the determined link
			router.push(backLink.href);
		}
	};

	return (
		<>
			<main className="container mx-auto px-4 py-8">
				{/* Smart back button */}
				{backLink && (
					<div className="mb-4">
						<button onClick={handleBackClick} className="text-sm text-gray-600 hover:text-gray-800 hover:underline">
							← {backLink.label}
						</button>
					</div>
				)}

				<div className="mb-8">
					<HeaderPage title={recipe.name} subtitle={subtitle} />
				</div>

				{/* Recipe Editor handles both view and edit modes internally */}
				<RecipeEditor recipe={recipe} collections={collections} />
			</main>
		</>
	);
};

export default RecipeDetailsClient;
