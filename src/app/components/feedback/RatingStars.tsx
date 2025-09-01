'use client';

import React from 'react';

interface RatingStarsProps {
	rating: number;
	onChange: (rating: number) => void;
	disabled?: boolean;
}

export default function RatingStars({ rating, onChange, disabled = false }: RatingStarsProps) {
	return (
		<div className="flex gap-1">
			{[1, 2, 3, 4, 5].map(star => (
				<button
					key={star}
					type="button"
					onClick={() => onChange(star)}
					disabled={disabled}
					className={`text-2xl transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
					aria-label={`Rate ${star} stars`}
				>
					<span className={star <= rating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}>★</span>
				</button>
			))}
		</div>
	);
}
