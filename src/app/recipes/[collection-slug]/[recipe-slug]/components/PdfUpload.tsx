'use client';

import { useState } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
import { UpdatePdfResponse } from '@/types/fileUpload';

interface PdfUploadProps {
	onPdfUploaded?: (uploadResponse?: UpdatePdfResponse) => void;
	recipeId?: number;
	isEditing?: boolean;
}

const PdfUpload = ({ onPdfUploaded, recipeId, isEditing = false }: PdfUploadProps) => {
	const [isDragOver, setIsDragOver] = useState(false);
	const pdfUpload = useFileUpload({
		allowedTypes: ['application/pdf'],
		maxSize: 10 * 1024 * 1024, // 10MB
		uploadEndpoint: isEditing ? '/api/recipe/update-pdf' : '/api/recipe/upload-pdf',
	});

	const handlePdfUpload = async () => {
		if (recipeId && pdfUpload.selectedFile) {
			const result = await pdfUpload.uploadFile(recipeId, 'pdf');
			if (result.success && onPdfUploaded) {
				// Cast the generic response to UpdatePdfResponse for PDF uploads
				onPdfUploaded(result.data as unknown as UpdatePdfResponse);
			}
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);

		const files = e.dataTransfer.files;
		if (files.length > 0) {
			const file = files[0];
			if (file.type === 'application/pdf') {
				const event = {
					target: { files: [file] },
				} as unknown as React.ChangeEvent<HTMLInputElement>;
				pdfUpload.handleFileSelect(event);
			}
		}
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="text-center">
				<h3 className="text-lg font-semibold text-foreground">Upload Recipe PDF</h3>
				<p className="text-sm text-secondary mt-1">{recipeId ? 'Replace the current recipe PDF' : 'Add a PDF version of this recipe'}</p>
			</div>

			{/* Drop Zone */}
			{!pdfUpload.selectedFile ? (
				<div
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
						isDragOver ? 'border-accent bg-accent' : 'border-custom hover:border-accent hover:bg-accent'
					}`}
				>
					{/* PDF Icon */}
					<div className="flex justify-center mb-4">
						<svg className="w-12 h-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</div>

					{/* Drop Zone Content */}
					<div className="space-y-2">
						<p className="text-lg font-medium text-foreground">{isDragOver ? 'Drop PDF here' : 'Drag & drop a PDF file'}</p>
						<p className="text-sm text-muted">or</p>
						<label className="inline-block">
							<span className="btn-default px-4 py-2 rounded-full cursor-pointer hover:shadow transition-all">Choose PDF File</span>
							<input type="file" accept="application/pdf" onChange={pdfUpload.handleFileSelect} className="hidden" />
						</label>
					</div>

					{/* File Requirements */}
					<p className="text-xs text-muted mt-4 border-t border-custom pt-3">PDF files only • Maximum 10MB</p>
				</div>
			) : (
				/* Selected File Display */
				<div className="border border-custom rounded-lg p-6 bg-surface">
					{/* File Info */}
					<div className="flex items-start space-x-4">
						<div className="flex-shrink-0">
							<svg className="w-10 h-10 text-muted" fill="currentColor" viewBox="0 0 24 24">
								<path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
								<path d="M11,19V17H8V19H11M16,19V15H13V19H16M16,13V11H8V13H16Z" fill="white" />
							</svg>
						</div>
						<div className="flex-1 min-w-0">
							<p className="font-medium text-foreground truncate">{pdfUpload.selectedFile.name}</p>
							<p className="text-sm text-muted">{(pdfUpload.selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center justify-between mt-4 pt-4 border-t border-custom">
						<button
							type="button"
							onClick={pdfUpload.clearFile}
							disabled={pdfUpload.isUploading}
							className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
						>
							Remove file
						</button>
						{recipeId && (
							<button
								type="button"
								onClick={handlePdfUpload}
								disabled={pdfUpload.isUploading}
								className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-full hover:bg-green-700 transition-colors disabled:opacity-50"
							>
								{pdfUpload.isUploading ? 'Uploading...' : 'Upload PDF'}
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

// Export the hook for cases where we need the file data
export { useFileUpload as usePdfUpload };
export default PdfUpload;
