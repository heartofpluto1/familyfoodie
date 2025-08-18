'use client';

import React from 'react';
import { PlusIcon, SaveIcon } from '@/app/components/Icons';
import { CategoryData } from '../page';
import { useIngredientAdd } from '../hooks/useIngredientAdd';

interface AddIngredientFormProps {
	supermarketCategories: CategoryData[];
	pantryCategories: CategoryData[];
}

export function AddIngredientForm({ supermarketCategories, pantryCategories }: AddIngredientFormProps) {
	const { isAdding, isLoading, newIngredientData, setNewIngredientData, handleStartAdd, handleAddSave, handleAddCancel } = useIngredientAdd();

	if (!isAdding) {
		return (
			<div className="p-6 border-b border-light bg-surface/50">
				<button
					onClick={handleStartAdd}
					className="flex items-center gap-2 px-6 py-3 bg-accent text-background rounded-md hover:bg-accent/90 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
				>
					<PlusIcon className="w-5 h-5" />
					Add New Ingredient
				</button>
			</div>
		);
	}

	return (
		<div className="p-6 border-b border-light bg-surface/50">
			<div className="bg-background border border-custom rounded-lg p-6 shadow-sm">
				<div className="flex items-center justify-between mb-6">
					<h3 className="text-xl font-semibold text-foreground flex items-center gap-3">
						<div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
							<PlusIcon className="w-4 h-4 text-accent" />
						</div>
						Add New Ingredient
					</h3>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Left Column */}
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-foreground mb-2">Ingredient Name *</label>
							<input
								type="text"
								value={newIngredientData.name}
								onChange={e => setNewIngredientData(prev => ({ ...prev, name: e.target.value }))}
								className="w-full px-4 py-3 text-sm bg-background text-foreground border border-custom rounded-md focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
								placeholder="Enter ingredient name"
								title="Ingredient name"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-foreground mb-2">Supermarket Category</label>
							<select
								value={newIngredientData.supermarketCategoryId || ''}
								onChange={e => {
									const value = e.target.value;
									setNewIngredientData(prev => ({
										...prev,
										supermarketCategoryId: value ? parseInt(value) : null,
									}));
								}}
								className="w-full px-4 py-3 text-sm bg-background text-foreground border border-custom rounded-md focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
								title="Supermarket category"
							>
								<option value="">Select category</option>
								{supermarketCategories.map(cat => (
									<option key={cat.id} value={cat.id}>
										{cat.name}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-sm font-medium text-foreground mb-2">Pantry Category</label>
							<select
								value={newIngredientData.pantryCategoryId || ''}
								onChange={e => {
									const value = e.target.value;
									setNewIngredientData(prev => ({
										...prev,
										pantryCategoryId: value ? parseInt(value) : null,
									}));
								}}
								className="w-full px-4 py-3 text-sm bg-background text-foreground border border-custom rounded-md focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
								title="Pantry category"
							>
								<option value="">Select category</option>
								{pantryCategories.map(cat => (
									<option key={cat.id} value={cat.id}>
										{cat.name}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Right Column */}
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-foreground mb-2">Fresh Item</label>
							<div className="flex items-center p-4 border border-custom rounded-md bg-surface/50">
								<label className="flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={newIngredientData.fresh}
										onChange={e => setNewIngredientData(prev => ({ ...prev, fresh: e.target.checked }))}
										className="h-5 w-5 text-accent rounded border-2 border-custom focus:ring-2 focus:ring-accent/20"
									/>
									<span className="text-sm font-medium text-foreground">This is a fresh ingredient</span>
								</label>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-foreground mb-2">Price (AUD)</label>
							<input
								type="number"
								step="0.01"
								value={newIngredientData.price || ''}
								onChange={e => {
									const value = e.target.value;
									setNewIngredientData(prev => ({
										...prev,
										price: value ? parseFloat(value) : null,
									}));
								}}
								className="w-full px-4 py-3 text-sm bg-background text-foreground border border-custom rounded-md focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
								placeholder="0.00"
								title="Price"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-foreground mb-2">Stockcode</label>
							<input
								type="text"
								value={newIngredientData.stockcode || ''}
								onChange={e => {
									const value = e.target.value;
									setNewIngredientData(prev => ({
										...prev,
										stockcode: value ? parseInt(value) : null,
									}));
								}}
								className="w-full px-4 py-3 text-sm bg-background text-foreground border border-custom rounded-md focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
								placeholder="Enter stockcode"
								title="Stockcode"
							/>
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-light">
					<button
						onClick={handleAddCancel}
						disabled={isLoading}
						className="px-6 py-3 text-sm font-medium text-secondary border border-custom rounded-md hover:bg-surface transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onClick={handleAddSave}
						disabled={isLoading}
						className="flex items-center gap-2 px-6 py-3 bg-accent text-background rounded-md hover:bg-accent/90 transition-all duration-200 font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isLoading ? (
							<>
								<div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></div>
								Saving...
							</>
						) : (
							<>
								<SaveIcon className="w-4 h-4" />
								Save Ingredient
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
