'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon, RemoveIcon } from './Icons';

interface RecipeSearchProps {
	onSearch: (searchTerm: string) => void;
	resultsCount: number;
	totalCount: number;
	initialSearchTerm?: string;
}

const RecipeSearch = ({ onSearch, resultsCount, totalCount, initialSearchTerm = '' }: RecipeSearchProps) => {
	const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

	// Update search term when initialSearchTerm changes
	useEffect(() => {
		setSearchTerm(initialSearchTerm);
	}, [initialSearchTerm]);

	const router = useRouter();
	const searchParams = useSearchParams();

	// Update URL and trigger search when searchTerm changes
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			// Update URL search parameters
			const params = new URLSearchParams(searchParams.toString());
			if (searchTerm.trim()) {
				params.set('search', searchTerm.trim());
			} else {
				params.delete('search');
			}

			// Update the URL without causing a page refresh
			const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
			router.replace(newUrl, { scroll: false });

			// Trigger the search callback
			onSearch(searchTerm);
		}, 200);

		return () => clearTimeout(timeoutId);
	}, [searchTerm, onSearch, router, searchParams]);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
	};

	const clearSearch = useCallback(() => {
		setSearchTerm('');
	}, []);

	return (
		<div className="w-full max-w-md">
			<div className="relative">
				<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
					<SearchIcon />
				</div>
				<input
					type="text"
					value={searchTerm}
					onChange={handleSearchChange}
					placeholder="Search recipes, ingredients, or seasons..."
					className="block w-full pl-10 pr-3 py-2 border border-custom rounded-md leading-5 bg-surface text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
				/>
				{searchTerm && (
					<button
						onClick={clearSearch}
						className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-foreground transition-colors"
						type="button"
						aria-label="Clear search"
					>
						<RemoveIcon className="h-5 w-5" />
					</button>
				)}
			</div>

			<div className="mt-2 h-5 flex items-center justify-end">
				{searchTerm && (
					<div className="text-sm text-muted">
						{resultsCount} of {totalCount} recipes
					</div>
				)}
			</div>
		</div>
	);
};

export default RecipeSearch;
