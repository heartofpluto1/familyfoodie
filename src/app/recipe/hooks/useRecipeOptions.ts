import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ToastProvider';

interface RecipeOptions {
	seasons: { id: number; name: string }[];
	primaryTypes: { id: number; name: string }[];
	secondaryTypes: { id: number; name: string }[];
	ingredients: {
		id: number;
		name: string;
		pantryCategory_id: number;
		pantryCategory_name: string;
	}[];
	measures: { id: number; name: string }[];
	preparations: { id: number; name: string }[];
}

export const useRecipeOptions = () => {
	const { showToast } = useToast();
	const [options, setOptions] = useState<RecipeOptions | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const fetchOptions = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/recipe/options');
			if (response.ok) {
				const data: RecipeOptions = await response.json();
				setOptions(data);
			} else {
				showToast('error', 'Error', 'Failed to load recipe options');
			}
		} catch (error) {
			console.error('Error fetching options:', error);
			showToast('error', 'Error', 'Error loading recipe options');
		} finally {
			setIsLoading(false);
		}
	}, [showToast]);

	useEffect(() => {
		fetchOptions();
	}, [fetchOptions]);

	return { options, isLoading, refetch: fetchOptions };
};
