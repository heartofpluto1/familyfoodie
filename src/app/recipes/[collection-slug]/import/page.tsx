import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import AIRecipeImportClient from './ai-recipe-import-client';
import { getCollectionById } from '@/lib/queries/collections';
import { parseSlugPath } from '@/lib/utils/urlHelpers';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export async function generateMetadata({ params }: { params: Promise<{ 'collection-slug': string }> }): Promise<Metadata> {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	if (!parsed) {
		return {
			title: 'Import Recipe | Family Foodie',
			description: 'Upload PDF or JPG files and let AI automatically extract recipe data',
		};
	}

	return {
		title: `Import Recipe | Family Foodie`,
		description: `Upload PDF or JPG files and let AI automatically extract recipe data`,
	};
}

interface ImportPageProps {
	params: Promise<{ 'collection-slug': string }>;
}

export default async function AIRecipeImportPage({ params }: ImportPageProps) {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	// If URL format is invalid, show 404
	if (!parsed) {
		notFound();
	}

	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}

	const collection = await getCollectionById(parsed.id);

	// If collection not found, show 404
	if (!collection) {
		notFound();
	}

	return <AIRecipeImportClient collection={collection} />;
}
