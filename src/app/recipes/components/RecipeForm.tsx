'use client';

import { Collection } from '@/lib/queries/collections';

interface RecipeFormData {
	name: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	seasonId?: number;
	primaryTypeId?: number;
	secondaryTypeId?: number;
	collectionId?: number;
}

interface RecipeOptions {
	seasons: { id: number; name: string }[];
	primaryTypes: { id: number; name: string }[];
	secondaryTypes: { id: number; name: string }[];
	ingredients: { id: number; name: string }[];
	measures: { id: number; name: string }[];
	preparations: { id: number; name: string }[];
}

interface RecipeFormProps {
	formData: RecipeFormData;
	onChange: (data: RecipeFormData) => void;
	options: RecipeOptions | null;
	collection?: Collection;
	isNewRecipe?: boolean;
	seasonReason?: string | null;
}

const RecipeForm = ({ formData, onChange, options, collection, isNewRecipe = false, seasonReason }: RecipeFormProps) => {
	const handleFieldChange = (field: keyof RecipeFormData, value: string | number | undefined) => {
		onChange({ ...formData, [field]: value });
	};

	return (
		<div className="space-y-4">
			{/* Recipe Name */}
			<div>
				<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipe Name {isNewRecipe && '*'}</label>
				<input
					type="text"
					value={formData.name}
					onChange={e => handleFieldChange('name', e.target.value)}
					className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
					placeholder={isNewRecipe ? 'Enter recipe name' : undefined}
				/>
			</div>

			{/* Description */}
			<div>
				<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description {isNewRecipe && '*'}</label>
				<textarea
					value={formData.description}
					onChange={e => handleFieldChange('description', e.target.value)}
					rows={4}
					className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
					placeholder={isNewRecipe ? 'Enter recipe description' : undefined}
				/>
			</div>

			{/* Times */}
			<div className="grid grid-cols-2 gap-4">
				<div>
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prep Time (min)</label>
					<input
						type="number"
						value={formData.prepTime || ''}
						onChange={e => handleFieldChange('prepTime', e.target.value ? parseInt(e.target.value) : undefined)}
						className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
						placeholder="0"
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cook Time (min)</label>
					<input
						type="number"
						value={formData.cookTime || ''}
						onChange={e => handleFieldChange('cookTime', e.target.value ? parseInt(e.target.value) : undefined)}
						className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
						placeholder="0"
					/>
				</div>
			</div>

			{/* Dropdowns */}
			{options && (
				<div className="space-y-4">
					{/* Collection Display */}
					{collection && (
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Collection</label>
							<div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-gray-100">
								{collection.title}
							</div>
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Season</label>
						<select
							value={formData.seasonId || ''}
							onChange={e => handleFieldChange('seasonId', e.target.value ? parseInt(e.target.value) : undefined)}
							className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
						>
							<option value="">Select season...</option>
							{options.seasons.map(season => (
								<option key={season.id} value={season.id}>
									{season.name}
								</option>
							))}
						</select>
						{seasonReason && (
							<div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-sm">
								<p className="text-xs text-blue-800 dark:text-blue-200">
									<span className="font-medium">AI Recommendation:</span> {seasonReason}
								</p>
							</div>
						)}
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Type</label>
							<select
								value={formData.primaryTypeId || ''}
								onChange={e => handleFieldChange('primaryTypeId', e.target.value ? parseInt(e.target.value) : undefined)}
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
							>
								<option value="">Select primary...</option>
								{options.primaryTypes.map(type => (
									<option key={type.id} value={type.id}>
										{type.name}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secondary Type</label>
							<select
								value={formData.secondaryTypeId || ''}
								onChange={e => handleFieldChange('secondaryTypeId', e.target.value ? parseInt(e.target.value) : undefined)}
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
							>
								<option value="">Select secondary...</option>
								{options.secondaryTypes.map(type => (
									<option key={type.id} value={type.id}>
										{type.name}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default RecipeForm;
