'use client';

import { useFileUpload } from '../hooks/useFileUpload';

interface PdfUploadProps {
	onPdfUploaded?: () => void;
	recipeId?: number;
}

const PdfUpload = ({ onPdfUploaded, recipeId }: PdfUploadProps) => {
	const pdfUpload = useFileUpload({
		allowedTypes: ['application/pdf'],
		maxSize: 10 * 1024 * 1024, // 10MB
		uploadEndpoint: '/api/recipe/upload-pdf',
	});

	const handlePdfUpload = async () => {
		if (recipeId && pdfUpload.selectedFile) {
			const success = await pdfUpload.uploadFile(recipeId, 'pdf');
			if (success && onPdfUploaded) {
				onPdfUploaded();
			}
		}
	};

	return (
		<div>
			<label className="block text-sm font-medium mb-1">Recipe PDF</label>
			<div className="space-y-2">
				<input
					type="file"
					accept="application/pdf"
					onChange={pdfUpload.handleFileSelect}
					className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent"
				/>
				{pdfUpload.selectedFile && (
					<div className="flex items-center gap-2">
						<span className="text-sm text-gray-600">Selected: {pdfUpload.selectedFile.name}</span>
						{recipeId && (
							<button
								type="button"
								onClick={handlePdfUpload}
								disabled={pdfUpload.isUploading}
								className="px-3 py-1 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors disabled:opacity-50 text-xs"
							>
								{pdfUpload.isUploading ? 'Uploading...' : 'Upload'}
							</button>
						)}
						<button
							type="button"
							onClick={pdfUpload.clearFile}
							disabled={pdfUpload.isUploading}
							className="px-3 py-1 bg-gray-500 text-white rounded-sm hover:bg-gray-600 transition-colors disabled:opacity-50 text-xs"
						>
							{recipeId ? 'Cancel' : 'Remove'}
						</button>
					</div>
				)}
				<p className="text-xs text-gray-500">
					PDF files only (max 10MB). {recipeId ? 'Will replace existing recipe PDF.' : 'Will be uploaded after recipe creation.'}
				</p>
			</div>
		</div>
	);
};

// Export the hook for cases where we need the file data
export { useFileUpload as usePdfUpload };
export default PdfUpload;
