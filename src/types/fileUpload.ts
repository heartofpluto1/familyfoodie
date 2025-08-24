export interface FileUploadResponse {
	success: boolean;
	message: string;
	filename: string;
	url: string;
	cacheBustedUrl: string;
	storageMode: string;
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
