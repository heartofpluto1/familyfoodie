import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getAllRecipesWithDetails } from '@/lib/queries/menus';
import { getCollectionById } from '@/lib/queries/collections';
import { parseSlugPath, generateSlugPath, generateSlugFromTitle } from '@/lib/utils/urlHelpers';
import withAuth from '@/app/components/withAuth';
import { Suspense } from 'react';
import Link from 'next/link';
import RecipeCard from '@/app/components/RecipeCard';
import { SparklesIcon } from '@/app/components/Icons';

export async function generateMetadata({ params }: { params: Promise<{ 'collection-slug': string }> }): Promise<Metadata> {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	if (!parsed) {
		return {
			title: 'Collection Not Found',
			description: 'The requested collection could not be found',
		};
	}

	const collection = await getCollectionById(parsed.id);
	if (!collection) {
		return {
			title: 'Collection Not Found',
			description: 'The requested collection could not be found',
		};
	}

	return {
		title: `${collection.title} Recipes`,
		description: collection.subtitle || `Browse recipes from the ${collection.title} collection`,
	};
}

interface RecipesPageProps {
	params: Promise<{ 'collection-slug': string }>;
}

async function RecipesPage({ params }: RecipesPageProps) {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	// If URL format is invalid, redirect to main recipes page
	if (!parsed) {
		redirect('/recipes');
	}

	const [recipes, selectedCollection] = await Promise.all([getAllRecipesWithDetails(parsed.id), getCollectionById(parsed.id)]);

	// If collection not found, show 404
	if (!selectedCollection) {
		notFound();
	}

	// Optional: Redirect if slug doesn't match current url_slug (for SEO consistency)
	const currentSlug = selectedCollection.url_slug
		? generateSlugPath(selectedCollection.id, selectedCollection.url_slug)
		: generateSlugFromTitle(selectedCollection.id, selectedCollection.title);
	if (slug !== currentSlug) {
		redirect(`/recipes/${currentSlug}`);
	}

	const getSubtitle = () => {
		return `${recipes.length} recipes in this collection`;
	};

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<div className="mb-4">
					<Link href="/recipes" className="text-muted text-sm">
						← Back to Collections
					</Link>
				</div>
			</div>

			{selectedCollection && (
				<div className="mb-8">
					<div className="flex items-center gap-6">
						<div className="group">
							<h2 className="text-2xl text-foreground">{selectedCollection.title}</h2>
							{selectedCollection.subtitle && <p className="text-sm text-muted">{selectedCollection.subtitle}</p>}
							<p className="text-sm text-muted pt-4">{getSubtitle()}</p>
						</div>
					</div>
				</div>
			)}

			<div className="mb-6 flex items-start justify-between gap-4">
				<div className="flex gap-3 flex-shrink-0">
					<Link
						href={`/recipes/${slug}/import`}
						className="inline-flex items-center bg-blue-600 hover:bg-blue-700 gap-2 px-4 py-2 text-white rounded-sm transition-colors shadow-md hover:shadow-lg"
					>
						<SparklesIcon className="w-4 h-4" />
						PDF Import (powered by AI)
					</Link>
				</div>
			</div>

			<Suspense fallback={<div>Loading recipes...</div>}>
				{recipes.length === 0 ? (
					<div className="text-center py-8">
						<p className="text-muted">No recipes found in this collection.</p>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{recipes.map(recipe => (
							<RecipeCard key={recipe.id} recipe={recipe} />
						))}
					</div>
				)}
			</Suspense>
		</main>
	);
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipesPage);
