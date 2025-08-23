import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AIRecipeImportClient from './ai-recipe-import-client';
import { getCollectionById } from '@/lib/queries/collections';
import { parseSlugPath } from '@/lib/utils/urlHelpers';
import withAuth from '@/app/components/withAuth';

export async function generateMetadata({ params }: { params: Promise<{ 'collection-slug': string }> }): Promise<Metadata> {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	if (!parsed) {
		return {
			title: 'Import Recipe | Family Foodie',
			description: 'Upload PDF or JPG files and let AI automatically extract recipe data',
		};
	}

	const collection = await getCollectionById(parsed.id);
	if (!collection) {
		return {
			title: 'Import Recipe | Family Foodie',
			description: 'Upload PDF or JPG files and let AI automatically extract recipe data',
		};
	}

	return {
		title: `Import Recipe to ${collection.title} | Family Foodie`,
		description: `Upload PDF or JPG files and let AI automatically extract recipe data into ${collection.title}`,
	};
}

interface ImportPageProps {
	params: Promise<{ 'collection-slug': string }>;
}

async function AIRecipeImportPage({ params }: ImportPageProps) {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	// If URL format is invalid, show 404
	if (!parsed) {
		notFound();
	}

	const collection = await getCollectionById(parsed.id);

	// If collection not found, show 404
	if (!collection) {
		notFound();
	}

	return <AIRecipeImportClient collection={collection} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(AIRecipeImportPage);
