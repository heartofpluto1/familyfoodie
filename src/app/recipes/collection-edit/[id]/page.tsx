import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import CollectionEditClient from './collection-edit-client';

interface PageProps {
	params: Promise<{ id: string }>;
}

interface CollectionRow extends RowDataPacket {
	id: number;
	title: string;
	subtitle: string | null;
	filename: string;
	filename_dark: string;
	show_overlay: number; // TINYINT from database
	url_slug: string;
	household_id: number;
	created_at: Date;
	updated_at: Date;
	access_type?: string;
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
		const [rows] = await pool.execute<CollectionRow[]>(
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

		const row = rows[0] as CollectionRow;
		return {
			id: row.id,
			title: row.title,
			subtitle: row.subtitle,
			filename: row.filename,
			filename_dark: row.filename_dark,
			show_overlay: !!row.show_overlay, // Convert TINYINT to boolean
			url_slug: row.url_slug,
			household_id: row.household_id,
			access_type: row.access_type,
		};
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
