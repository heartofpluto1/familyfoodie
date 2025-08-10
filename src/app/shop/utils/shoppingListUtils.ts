export const roundToTwo = (num?: number): string | null => {
	return num ? `${Math.round(num * 100) / 100}` : null;
};

export const formatPrice = (price?: number): string => {
	if (!price) return '';
	return price.toLocaleString('en-AU', {
		style: 'currency',
		currency: 'AUD',
	});
};

export const capitalizeFirstLetter = (text: string): string => {
	return text.charAt(0).toUpperCase() + text.slice(1);
};
