import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import HeaderPage from '@/app/components/HeaderPage';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
	title: 'System Analytics',
	description: 'System resource usage and orphaned assets',
};

interface OrphanedFile {
	filename: string;
	type: 'collection' | 'recipe-image' | 'recipe-pdf';
}

interface OrphanedRecord {
	id: number;
	name: string;
	type: string;
}

async function getOrphanedCollectionFiles(): Promise<OrphanedFile[]> {
	try {
		// Get all collection filenames from database
		const [rows] = await pool.execute<RowDataPacket[]>('SELECT filename, filename_dark FROM collections');
		const dbFilenames = new Set<string>();

		rows.forEach(row => {
			if (row.filename) dbFilenames.add(row.filename);
			if (row.filename_dark) dbFilenames.add(row.filename_dark);
		});

		// Check files in public/collections directory
		const collectionsDir = path.join(process.cwd(), 'public', 'collections');
		const orphaned: OrphanedFile[] = [];

		try {
			const files = await fs.readdir(collectionsDir);

			for (const file of files) {
				// Skip overlay files and non-image files
				if (file.includes('overlay') || !file.match(/\.(jpg|jpeg|png)$/i)) {
					continue;
				}

				// Remove extension for comparison
				const filenameWithoutExt = file.replace(/\.(jpg|jpeg|png)$/i, '');

				// Check if this file is referenced in the database
				let isReferenced = false;
				for (const dbFile of dbFilenames) {
					if (dbFile.includes(filenameWithoutExt)) {
						isReferenced = true;
						break;
					}
				}

				if (!isReferenced) {
					orphaned.push({ filename: file, type: 'collection' });
				}
			}
		} catch (error) {
			console.error('Error reading collections directory:', error);
		}

		return orphaned;
	} catch (error) {
		console.error('Error getting orphaned collection files:', error);
		return [];
	}
}

async function getOrphanedRecipeFiles(): Promise<{ images: OrphanedFile[]; pdfs: OrphanedFile[] }> {
	try {
		// Get all recipe filenames from database
		const [rows] = await pool.execute<RowDataPacket[]>('SELECT image_filename, pdf_filename FROM recipes');
		const dbImageFilenames = new Set<string>();
		const dbPdfFilenames = new Set<string>();

		rows.forEach(row => {
			if (row.image_filename) dbImageFilenames.add(row.image_filename);
			if (row.pdf_filename) dbPdfFilenames.add(row.pdf_filename);
		});

		// Check files in public/static directory
		const staticDir = path.join(process.cwd(), 'public', 'static');
		const orphanedImages: OrphanedFile[] = [];
		const orphanedPdfs: OrphanedFile[] = [];

		try {
			const files = await fs.readdir(staticDir);

			for (const file of files) {
				if (file.match(/\.(jpg|jpeg|png)$/i)) {
					// Check if this image is referenced in the database
					const filenameWithoutExt = file.replace(/\.(jpg|jpeg|png)$/i, '');
					let isReferenced = false;

					for (const dbFile of dbImageFilenames) {
						if (dbFile.includes(filenameWithoutExt)) {
							isReferenced = true;
							break;
						}
					}

					if (!isReferenced) {
						orphanedImages.push({ filename: file, type: 'recipe-image' });
					}
				} else if (file.endsWith('.pdf')) {
					// Check if this PDF is referenced in the database
					const filenameWithoutExt = file.replace(/\.pdf$/i, '');
					let isReferenced = false;

					for (const dbFile of dbPdfFilenames) {
						if (dbFile.includes(filenameWithoutExt)) {
							isReferenced = true;
							break;
						}
					}

					if (!isReferenced) {
						orphanedPdfs.push({ filename: file, type: 'recipe-pdf' });
					}
				}
			}
		} catch (error) {
			console.error('Error reading static directory:', error);
		}

		return { images: orphanedImages, pdfs: orphanedPdfs };
	} catch (error) {
		console.error('Error getting orphaned recipe files:', error);
		return { images: [], pdfs: [] };
	}
}

async function getOrphanedIngredients(): Promise<OrphanedRecord[]> {
	try {
		const [rows] = await pool.execute<RowDataPacket[]>(`
			SELECT i.id, i.name 
			FROM ingredients i
			LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
			WHERE ri.id IS NULL
			ORDER BY i.name
		`);

		return rows.map(row => ({
			id: row.id,
			name: row.name,
			type: 'ingredient',
		}));
	} catch (error) {
		console.error('Error getting orphaned ingredients:', error);
		return [];
	}
}

async function getOrphanedRecipes(): Promise<OrphanedRecord[]> {
	try {
		const [rows] = await pool.execute<RowDataPacket[]>(`
			SELECT r.id, r.name 
			FROM recipes r
			LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
			LEFT JOIN plans p ON r.id = p.recipe_id
			WHERE cr.id IS NULL AND p.id IS NULL
			ORDER BY r.name
		`);

		return rows.map(row => ({
			id: row.id,
			name: row.name,
			type: 'recipe',
		}));
	} catch (error) {
		console.error('Error getting orphaned recipes:', error);
		return [];
	}
}

export default async function SystemAnalyticsPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.is_admin) {
		redirect('/auth/signin');
	}

	// Fetch all orphaned data
	const [orphanedCollectionFiles, recipeFiles, orphanedIngredients, orphanedRecipes] = await Promise.all([
		getOrphanedCollectionFiles(),
		getOrphanedRecipeFiles(),
		getOrphanedIngredients(),
		getOrphanedRecipes(),
	]);

	const { images: orphanedRecipeImages, pdfs: orphanedRecipePdfs } = recipeFiles;

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="System Analytics" subtitle="Monitor system resources and identify orphaned assets" />
			</div>

			<div className="space-y-8">
				{/* Orphaned Collection Files */}
				<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
					<h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
						<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
						Orphaned Collection Files
						<span className="text-sm font-normal text-muted">({orphanedCollectionFiles.length} found)</span>
					</h2>
					{orphanedCollectionFiles.length > 0 ? (
						<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
							<ul className="space-y-1 text-sm">
								{orphanedCollectionFiles.map((file, index) => (
									<li key={index} className="text-muted">
										/collections/{file.filename}
									</li>
								))}
							</ul>
						</div>
					) : (
						<p className="text-muted">No orphaned collection files found.</p>
					)}
				</section>

				{/* Orphaned Recipe Images */}
				<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
					<h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
						<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
						Orphaned Recipe Images
						<span className="text-sm font-normal text-muted">({orphanedRecipeImages.length} found)</span>
					</h2>
					{orphanedRecipeImages.length > 0 ? (
						<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
							<ul className="space-y-1 text-sm">
								{orphanedRecipeImages.map((file, index) => (
									<li key={index} className="text-muted">
										/static/{file.filename}
									</li>
								))}
							</ul>
						</div>
					) : (
						<p className="text-muted">No orphaned recipe images found.</p>
					)}
				</section>

				{/* Orphaned Recipe PDFs */}
				<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
					<h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
						<svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
							/>
						</svg>
						Orphaned Recipe PDFs
						<span className="text-sm font-normal text-muted">({orphanedRecipePdfs.length} found)</span>
					</h2>
					{orphanedRecipePdfs.length > 0 ? (
						<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
							<ul className="space-y-1 text-sm">
								{orphanedRecipePdfs.map((file, index) => (
									<li key={index} className="text-muted">
										/static/{file.filename}
									</li>
								))}
							</ul>
						</div>
					) : (
						<p className="text-muted">No orphaned recipe PDFs found.</p>
					)}
				</section>

				{/* Orphaned Ingredients */}
				<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
					<h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
						<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
							/>
						</svg>
						Orphaned Ingredients
						<span className="text-sm font-normal text-muted">({orphanedIngredients.length} found)</span>
					</h2>
					{orphanedIngredients.length > 0 ? (
						<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
							<ul className="space-y-1 text-sm">
								{orphanedIngredients.map(ingredient => (
									<li key={ingredient.id} className="text-muted">
										<span className="font-mono text-xs text-gray-500">#{ingredient.id}</span> {ingredient.name}
									</li>
								))}
							</ul>
						</div>
					) : (
						<p className="text-muted">No orphaned ingredients found.</p>
					)}
				</section>

				{/* Orphaned Recipes */}
				<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
					<h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
						<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
							/>
						</svg>
						Orphaned Recipes
						<span className="text-sm font-normal text-muted">({orphanedRecipes.length} found)</span>
					</h2>
					<p className="text-sm text-muted mb-2">Recipes not referenced in any collection or meal plan</p>
					{orphanedRecipes.length > 0 ? (
						<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
							<ul className="space-y-1 text-sm">
								{orphanedRecipes.map(recipe => (
									<li key={recipe.id} className="text-muted">
										<span className="font-mono text-xs text-gray-500">#{recipe.id}</span> {recipe.name}
									</li>
								))}
							</ul>
						</div>
					) : (
						<p className="text-muted">No orphaned recipes found.</p>
					)}
				</section>

				{/* Summary Statistics */}
				<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
					<h2 className="text-xl font-semibold mb-4 text-foreground">Summary</h2>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
						<div className="text-center">
							<div className="text-2xl font-bold text-blue-600">{orphanedCollectionFiles.length}</div>
							<div className="text-sm text-muted">Collection Files</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-green-600">{orphanedRecipeImages.length}</div>
							<div className="text-sm text-muted">Recipe Images</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-red-600">{orphanedRecipePdfs.length}</div>
							<div className="text-sm text-muted">Recipe PDFs</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-yellow-600">{orphanedIngredients.length}</div>
							<div className="text-sm text-muted">Ingredients</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-purple-600">{orphanedRecipes.length}</div>
							<div className="text-sm text-muted">Recipes</div>
						</div>
					</div>
					<div className="mt-4 pt-4 border-t border-custom">
						<p className="text-sm text-muted">
							Total orphaned assets:{' '}
							<span className="font-semibold text-foreground">
								{orphanedCollectionFiles.length +
									orphanedRecipeImages.length +
									orphanedRecipePdfs.length +
									orphanedIngredients.length +
									orphanedRecipes.length}
							</span>
						</p>
					</div>
				</section>
			</div>
		</main>
	);
}
