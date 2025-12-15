'use client';

// Extract hero image from JPG/JPEG file using coordinates
const extractHeroImageFromImage = async (
	file: File,
	imageLocation: {
		pageIndex: number;
		x: number;
		y: number;
		width: number;
		height: number;
	}
): Promise<string | null> => {
	try {
		// Create an image element to load the file
		const img = new Image();
		const imageUrl = URL.createObjectURL(file);

		// Load the image
		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
			img.src = imageUrl;
		});

		// Create canvas for cropping
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Could not create canvas context');

		// Calculate crop dimensions relative to the actual image size
		const scaleX = img.naturalWidth / 600; // Assuming AI coordinates are based on 600px width
		const scaleY = img.naturalHeight / 400; // Assuming AI coordinates are based on 400px height

		const cropX = Math.max(0, Math.min(imageLocation.x * scaleX, img.naturalWidth));
		const cropY = Math.max(0, Math.min(imageLocation.y * scaleY, img.naturalHeight));
		const cropWidth = Math.min(imageLocation.width * scaleX, img.naturalWidth - cropX);
		const cropHeight = Math.min(imageLocation.height * scaleY, img.naturalHeight - cropY);

		// Set canvas size to the crop dimensions
		canvas.width = cropWidth;
		canvas.height = cropHeight;

		// Draw the cropped portion of the image
		context.drawImage(
			img,
			cropX,
			cropY,
			cropWidth,
			cropHeight, // Source coordinates and dimensions
			0,
			0,
			cropWidth,
			cropHeight // Destination coordinates and dimensions
		);

		// Clean up the object URL
		URL.revokeObjectURL(imageUrl);

		// Convert to base64 JPEG
		const heroImageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
		return heroImageDataUrl;
	} catch (error) {
		console.error('Error extracting hero image from image file:', error);
		return null;
	}
};

// Extract hero image from PDF or JPG using coordinates provided by AI
export const extractHeroImageFromPdf = async (
	file: File,
	imageLocation: {
		pageIndex: number;
		x: number;
		y: number;
		width: number;
		height: number;
	}
): Promise<string | null> => {
	try {
		// Check if the file is an image (JPG/JPEG)
		if (file.type.startsWith('image/')) {
			return await extractHeroImageFromImage(file, imageLocation);
		}

		// Handle PDF files
		const pdfjsLib = await import('pdfjs-dist');

		// Set worker source to the file in public directory
		pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

		// Convert file to ArrayBuffer
		const arrayBuffer = await file.arrayBuffer();

		// Load the PDF document
		const loadingTask = pdfjsLib.getDocument({
			data: new Uint8Array(arrayBuffer),
		});

		const pdfDoc = await loadingTask.promise;

		if (!pdfDoc || pdfDoc.numPages <= imageLocation.pageIndex) {
			throw new Error('Invalid page index or empty PDF');
		}

		// Get the specific page (pageIndex is 0-based, but getPage expects 1-based)
		const page = await pdfDoc.getPage(imageLocation.pageIndex + 1);
		const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

		// Create canvas for the full page
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Could not create canvas context');

		canvas.height = viewport.height;
		canvas.width = viewport.width;

		// Render the full page to canvas
		const renderContext = {
			canvasContext: context,
			canvas: canvas,
			viewport: viewport,
		};

		await page.render(renderContext).promise;

		// Scale the AI coordinates to match our rendered scale (2.0)
		const scale = 2.0;
		const cropX = Math.max(0, Math.min(imageLocation.x * scale, viewport.width));
		const cropY = Math.max(0, Math.min(imageLocation.y * scale, viewport.height));
		const cropWidth = Math.min(imageLocation.width * scale, viewport.width - cropX);
		const cropHeight = Math.min(imageLocation.height * scale, viewport.height - cropY);

		// Create a new canvas for the cropped image
		const croppedCanvas = document.createElement('canvas');
		const croppedContext = croppedCanvas.getContext('2d');
		if (!croppedContext) throw new Error('Could not create cropped canvas context');

		croppedCanvas.width = cropWidth;
		croppedCanvas.height = cropHeight;

		// Draw the cropped portion
		croppedContext.drawImage(
			canvas,
			cropX,
			cropY,
			cropWidth,
			cropHeight, // Source coordinates and dimensions
			0,
			0,
			cropWidth,
			cropHeight // Destination coordinates and dimensions
		);

		// Convert to base64 JPEG
		const heroImageDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.8);

		return heroImageDataUrl;
	} catch (error) {
		console.error('Error extracting hero image from PDF:', error);
		return null;
	}
};
