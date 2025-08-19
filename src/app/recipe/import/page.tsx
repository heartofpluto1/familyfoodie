import { Metadata } from 'next';
import AIRecipeImportClient from './ai-recipe-import-client';

export const metadata: Metadata = {
	title: 'AI Recipe Import from PDF | Family Foodie',
	description: 'Upload PDF files and let AI automatically extract recipe data',
};

export default function AIRecipeImportPage() {
	return <AIRecipeImportClient />;
}
