import { Metadata } from 'next';
import AIRecipeImportClient from './ai-recipe-import-client';
import { getCollectionsForDisplay } from '@/lib/queries/collections';
import withAuth from '@/app/components/withAuth';

export const metadata: Metadata = {
	title: 'AI Recipe Import | Family Foodie',
	description: 'Upload PDF or JPG files and let AI automatically extract recipe data',
};

async function AIRecipeImportPage() {
	const collections = await getCollectionsForDisplay();

	return <AIRecipeImportClient collections={collections} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(AIRecipeImportPage);
