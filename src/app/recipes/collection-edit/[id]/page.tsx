import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import CollectionEditClient from './collection-edit-client';

interface PageProps {
	params: Promise<{ id: string }>;
}

interface Collection {
	id: number;
	title: string;
	subtitle: string | null;
	filename: string;
	filename_dark: string;
	show_overlay: boolean;
	url_slug: string;
	household_id: number;
	access_type?: string;
}

async function getCollection(collectionId: number, householdId: number): Promise<Collection | null> {
	try {
		// Get collection with access type check
		const [rows] = await pool.execute<RowDataPacket[]>(
			`SELECT 
				c.id,
				c.title,
				c.subtitle,
				c.filename,
				c.filename_dark,
				c.show_overlay,
				c.url_slug,
				c.household_id,
				CASE 
					WHEN c.household_id = ? THEN 'owned'
					ELSE 'shared'
				END as access_type
			FROM collections c
			WHERE c.id = ? AND c.household_id = ?`,
			[householdId, collectionId, householdId]
		);

		if (rows.length === 0) {
			return null;
		}

		const collection = rows[0] as any;
		return {
			...collection,
			show_overlay: !!collection.show_overlay, // Convert TINYINT to boolean
		} as Collection;
	} catch (error) {
		console.error('Error fetching collection:', error);
		return null;
	}
}

export default async function CollectionEditPage({ params }: PageProps) {
	// Check authentication
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}

	const householdId = session.user.household_id;

	// Get collection ID from params
	const { id } = await params;
	const collectionId = parseInt(id);

	if (isNaN(collectionId)) {
		notFound();
	}

	// Fetch collection data
	const collection = await getCollection(collectionId, householdId);

	if (!collection) {
		notFound();
	}

	// Verify ownership - only owned collections can be edited
	if (collection.access_type !== 'owned') {
		redirect(`/recipes/${collection.url_slug}`);
	}

	return <CollectionEditClient collection={collection} />;
}
