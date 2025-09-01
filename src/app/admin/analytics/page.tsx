import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import HeaderPage from '@/app/components/HeaderPage';
import AnalyticsContent from './analytics-client';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

export const dynamic = 'force-dynamic';

// Determine if we should use GCS based on environment
const useGCS = process.env.NODE_ENV === 'production' && !!process.env.GCS_BUCKET_NAME;
const bucketName = process.env.GCS_BUCKET_NAME;

// Initialize Google Cloud Storage only if needed
const storage = useGCS
	? new Storage({
			projectId: process.env.GOOGLE_CLOUD_PROJECT,
		})
	: null;
const bucket = storage && bucketName ? storage.bucket(bucketName) : null;

export const metadata: Metadata = {
	title: 'System Analytics',
	description: 'System resource usage and orphaned assets',
};

interface OrphanedFile {
	filename: string;
	type: 'collection' | 'recipe-image' | 'recipe-pdf';
	size?: number;
}

interface OrphanedRecord {
	id: number;
	name: string;
	type: string;
	household_id?: number;
}

interface FileStats {
	total: number;
	totalSize: number;
	orphaned: number;
	orphanedSize: number;
}

async function getCollectionFileStats(): Promise<{ orphaned: OrphanedFile[]; stats: FileStats }> {
	try {
		// Get all collection filenames from database
		const [rows] = await pool.execute<RowDataPacket[]>('SELECT filename, filename_dark FROM collections');
		const dbFilenames = new Set<string>();

		rows.forEach(row => {
			if (row.filename) dbFilenames.add(row.filename);
			if (row.filename_dark) dbFilenames.add(row.filename_dark);
		});

		const orphaned: OrphanedFile[] = [];
		let totalFiles = 0;
		let totalSize = 0;
		let orphanedSize = 0;

		if (useGCS && bucket) {
			// Production: Check files in GCS bucket under collections/ prefix
			try {
				const [files] = await bucket.getFiles({ prefix: 'collections/' });

				for (const file of files) {
					const filename = file.name.replace('collections/', '');

					// Skip overlay files and non-image files
					if (filename.includes('overlay') || !filename.match(/\.(jpg|jpeg|png)$/i)) {
						continue;
					}

					const fileSize = parseInt(file.metadata.size?.toString() || '0');
					totalFiles++;
					totalSize += fileSize;

					// Remove extension for comparison
					const filenameWithoutExt = filename.replace(/\.(jpg|jpeg|png)$/i, '');

					// Check if this file is referenced in the database
					let isReferenced = false;
					for (const dbFile of dbFilenames) {
						if (dbFile.includes(filenameWithoutExt)) {
							isReferenced = true;
							break;
						}
					}

					if (!isReferenced) {
						orphaned.push({ filename: filename, type: 'collection', size: fileSize });
						orphanedSize += fileSize;
					}
				}
			} catch (error) {
				console.error('Error reading GCS collections:', error);
			}
		} else {
			// Development: Check files in public/collections directory
			const collectionsDir = path.join(process.cwd(), 'public', 'collections');

			try {
				// Check if directory exists first
				let files: string[] = [];
				try {
					await fs.access(collectionsDir);
					files = await fs.readdir(collectionsDir);
				} catch {
					// Directory doesn't exist, use empty array
					console.log('Collections directory does not exist:', collectionsDir);
				}

				for (const file of files) {
					// Skip overlay files and non-image files
					if (file.includes('overlay') || !file.match(/\.(jpg|jpeg|png)$/i)) {
						continue;
					}

					const filePath = path.join(collectionsDir, file);
					const stats = await fs.stat(filePath);
					const fileSize = stats.size;
					totalFiles++;
					totalSize += fileSize;

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
						orphaned.push({ filename: file, type: 'collection', size: fileSize });
						orphanedSize += fileSize;
					}
				}
			} catch (error) {
				console.error('Error reading collections directory:', error);
			}
		}

		return {
			orphaned,
			stats: {
				total: totalFiles,
				totalSize,
				orphaned: orphaned.length,
				orphanedSize,
			},
		};
	} catch (error) {
		console.error('Error getting collection file stats:', error);
		return { orphaned: [], stats: { total: 0, totalSize: 0, orphaned: 0, orphanedSize: 0 } };
	}
}

async function getRecipeFileStats(): Promise<{ orphanedImages: OrphanedFile[]; orphanedPdfs: OrphanedFile[]; imageStats: FileStats; pdfStats: FileStats }> {
	try {
		// Get all recipe filenames from database
		const [rows] = await pool.execute<RowDataPacket[]>('SELECT image_filename, pdf_filename FROM recipes');
		const dbImageFilenames = new Set<string>();
		const dbPdfFilenames = new Set<string>();

		rows.forEach(row => {
			if (row.image_filename) dbImageFilenames.add(row.image_filename);
			if (row.pdf_filename) dbPdfFilenames.add(row.pdf_filename);
		});

		const orphanedImages: OrphanedFile[] = [];
		const orphanedPdfs: OrphanedFile[] = [];
		let totalImages = 0;
		let totalImageSize = 0;
		let orphanedImageSize = 0;
		let totalPdfs = 0;
		let totalPdfSize = 0;
		let orphanedPdfSize = 0;

		if (useGCS && bucket) {
			// Production: Check files in GCS bucket (recipe files are stored at root level)
			try {
				// Get all files in the bucket (excluding those with prefixes like 'collections/')
				const [files] = await bucket.getFiles();

				for (const file of files) {
					// Skip files in subdirectories (collections/, etc.)
					if (file.name.includes('/')) continue;

					const fileSize = parseInt(file.metadata.size?.toString() || '0');

					if (file.name.match(/\.(jpg|jpeg|png)$/i)) {
						totalImages++;
						totalImageSize += fileSize;

						// Check if this image is referenced in the database
						const filenameWithoutExt = file.name.replace(/\.(jpg|jpeg|png)$/i, '');
						let isReferenced = false;

						for (const dbFile of dbImageFilenames) {
							if (dbFile.includes(filenameWithoutExt)) {
								isReferenced = true;
								break;
							}
						}

						if (!isReferenced) {
							orphanedImages.push({ filename: file.name, type: 'recipe-image', size: fileSize });
							orphanedImageSize += fileSize;
						}
					} else if (file.name.endsWith('.pdf')) {
						totalPdfs++;
						totalPdfSize += fileSize;

						// Check if this PDF is referenced in the database
						const filenameWithoutExt = file.name.replace(/\.pdf$/i, '');
						let isReferenced = false;

						for (const dbFile of dbPdfFilenames) {
							if (dbFile.includes(filenameWithoutExt)) {
								isReferenced = true;
								break;
							}
						}

						if (!isReferenced) {
							orphanedPdfs.push({ filename: file.name, type: 'recipe-pdf', size: fileSize });
							orphanedPdfSize += fileSize;
						}
					}
				}
			} catch (error) {
				console.error('Error reading GCS files:', error);
			}
		} else {
			// Development: Check files in public/static directory
			const staticDir = path.join(process.cwd(), 'public', 'static');

			try {
				// Check if directory exists first
				let files: string[] = [];
				try {
					await fs.access(staticDir);
					files = await fs.readdir(staticDir);
				} catch {
					// Directory doesn't exist, use empty array
					console.log('Static directory does not exist:', staticDir);
				}

				for (const file of files) {
					const filePath = path.join(staticDir, file);
					const stats = await fs.stat(filePath);
					const fileSize = stats.size;

					if (file.match(/\.(jpg|jpeg|png)$/i)) {
						totalImages++;
						totalImageSize += fileSize;

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
							orphanedImages.push({ filename: file, type: 'recipe-image', size: fileSize });
							orphanedImageSize += fileSize;
						}
					} else if (file.endsWith('.pdf')) {
						totalPdfs++;
						totalPdfSize += fileSize;

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
							orphanedPdfs.push({ filename: file, type: 'recipe-pdf', size: fileSize });
							orphanedPdfSize += fileSize;
						}
					}
				}
			} catch (error) {
				console.error('Error reading static directory:', error);
			}
		}

		return {
			orphanedImages,
			orphanedPdfs,
			imageStats: {
				total: totalImages,
				totalSize: totalImageSize,
				orphaned: orphanedImages.length,
				orphanedSize: orphanedImageSize,
			},
			pdfStats: {
				total: totalPdfs,
				totalSize: totalPdfSize,
				orphaned: orphanedPdfs.length,
				orphanedSize: orphanedPdfSize,
			},
		};
	} catch (error) {
		console.error('Error getting recipe file stats:', error);
		return {
			orphanedImages: [],
			orphanedPdfs: [],
			imageStats: { total: 0, totalSize: 0, orphaned: 0, orphanedSize: 0 },
			pdfStats: { total: 0, totalSize: 0, orphaned: 0, orphanedSize: 0 },
		};
	}
}

async function getOrphanedCollections(): Promise<OrphanedRecord[]> {
	try {
		const [rows] = await pool.execute<RowDataPacket[]>(`
			SELECT c.id, c.title as name, c.household_id,
			       (SELECT COUNT(*) FROM collection_recipes cr WHERE cr.collection_id = c.id) as recipe_count
			FROM collections c
			HAVING recipe_count = 0
			ORDER BY c.household_id, c.title
		`);

		return rows.map(row => ({
			id: row.id,
			name: row.name,
			type: 'collection',
			household_id: row.household_id,
		}));
	} catch (error) {
		console.error('Error getting orphaned collections:', error);
		return [];
	}
}

async function getOrphanedIngredients(): Promise<OrphanedRecord[]> {
	try {
		const [rows] = await pool.execute<RowDataPacket[]>(`
			SELECT i.id, i.name, i.household_id
			FROM ingredients i
			LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
			WHERE ri.ingredient_id IS NULL
			ORDER BY i.household_id, i.name
		`);

		return rows.map(row => ({
			id: row.id,
			name: row.name,
			type: 'ingredient',
			household_id: row.household_id,
		}));
	} catch (error) {
		console.error('Error getting orphaned ingredients:', error);
		return [];
	}
}

async function getOrphanedRecipes(): Promise<OrphanedRecord[]> {
	try {
		const [rows] = await pool.execute<RowDataPacket[]>(`
			SELECT r.id, r.name, r.household_id
			FROM recipes r
			LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
			LEFT JOIN plans p ON r.id = p.recipe_id
			WHERE cr.recipe_id IS NULL AND p.recipe_id IS NULL
			ORDER BY r.household_id, r.name
		`);

		return rows.map(row => ({
			id: row.id,
			name: row.name,
			type: 'recipe',
			household_id: row.household_id,
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
	const [collectionData, recipeData, orphanedCollections, orphanedIngredients, orphanedRecipes] = await Promise.all([
		getCollectionFileStats(),
		getRecipeFileStats(),
		getOrphanedCollections(),
		getOrphanedIngredients(),
		getOrphanedRecipes(),
	]);

	const { orphaned: orphanedCollectionFiles, stats: collectionStats } = collectionData;
	const { orphanedImages: orphanedRecipeImages, orphanedPdfs: orphanedRecipePdfs, imageStats, pdfStats } = recipeData;

	const analyticsData = {
		orphanedCollectionFiles,
		collectionStats,
		orphanedRecipeImages,
		orphanedRecipePdfs,
		imageStats,
		pdfStats,
		orphanedCollections,
		orphanedIngredients,
		orphanedRecipes,
		useGCS,
		bucketName,
	};

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="System Analytics" subtitle="Monitor system resources and identify orphaned assets" />
			</div>

			<AnalyticsContent data={analyticsData} />
		</main>
	);
}
