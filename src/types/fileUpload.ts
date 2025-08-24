export interface UpdateImageResponse {
	success: boolean;
	message: string;
	filename: string;
	uploadUrl: string;
	displayUrl: string;
	storageMode: string;
	cleanup?: string; // For update-image cleanup status
	previousImage?: string; // For upload-image when replacing existing image
}

export interface UpdatePdfResponse {
	success: boolean;
	message: string;
	recipe: {
		id: number;
		pdfUrl: string;
		filename: string;
	};
	upload: {
		storageUrl: string;
		storageMode: string;
		timestamp: string;
		fileSize: string;
	};
	conversion?: {
		originalFormat: string;
		convertedTo: string;
		originalFileName: string;
	};
}
