'use client';

// Simple PDF to images converter using PDF.js
export const convertPdfToImages = async (file: File): Promise<string[]> => {
	try {
		// Dynamically import PDF.js for client-side use
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

		if (!pdfDoc || pdfDoc.numPages === 0) {
			throw new Error('PDF appears to be empty or invalid');
		}

		const images: string[] = [];

		// Convert each page to image (limit to first 3 pages for performance)
		const maxPages = Math.min(pdfDoc.numPages, 3);

		for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
			try {
				const page = await pdfDoc.getPage(pageNum);
				const viewport = page.getViewport({ scale: 1.5 }); // Good quality/size balance

				// Create canvas
				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d');
				if (!context) continue;

				canvas.height = viewport.height;
				canvas.width = viewport.width;

				// Render PDF page to canvas
				const renderContext = {
					canvasContext: context,
					canvas: canvas,
					viewport: viewport,
				};

				await page.render(renderContext).promise;

				// Convert canvas to base64 image (JPEG for smaller size)
				const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
				images.push(imageDataUrl);
			} catch (pageError) {
				console.warn(`Error processing page ${pageNum}:`, pageError);
				// Continue with other pages
			}
		}

		if (images.length === 0) {
			throw new Error('No pages could be converted to images');
		}

		return images;
	} catch (error) {
		console.error('Error converting PDF to images:', error);
		throw new Error(`Failed to convert PDF to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};
