export interface FileUploadResponse {
	success: boolean;
	message: string;
	filename: string;
	url: string;
	cacheBustedUrl: string;
	storageMode: string;
}
