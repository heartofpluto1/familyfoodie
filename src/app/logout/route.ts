import { NextResponse } from 'next/server';

export async function GET() {
	// Return HTML that clears cookie and forces full page reload
	const html = `<!DOCTYPE html>
<html>
<head>
	<title>Logging out...</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
	<meta http-equiv="Pragma" content="no-cache">
	<meta http-equiv="Expires" content="0">
	<style>
		:root {
			/* Light mode */
			--background: #fafafa;
			--surface: #ffffff;
			--foreground: #171717;
			--foreground-muted: #737373;
			--accent: rgba(0, 0, 0, 0.1);
		}
		
		@media (prefers-color-scheme: dark) {
			:root {
				/* Dark mode */
				--background: #0a0a0a;
				--surface: #171717;
				--foreground: #fafafa;
				--foreground-muted: #a3a3a3;
				--accent: rgba(255, 255, 255, 0.1);
			}
		}
		
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			background-color: var(--background);
			color: var(--foreground);
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			padding: 2rem;
		}
		
		.container {
			text-align: center;
			background-color: var(--surface);
			padding: 3rem 2rem;
			border-radius: 0.75rem;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
			max-width: 24rem;
			width: 100%;
		}
		
		.title {
			font-size: 1.5rem;
			font-weight: 600;
			margin-bottom: 0.75rem;
			color: var(--foreground);
		}
		
		.message {
			color: var(--foreground-muted);
			margin-bottom: 2rem;
		}
		
		.spinner {
			width: 2rem;
			height: 2rem;
			border: 2px solid var(--accent);
			border-top: 2px solid var(--foreground);
			border-radius: 50%;
			animation: spin 1s linear infinite;
			margin: 0 auto;
		}
		
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
	</style>
</head>
<body>
	<div class="container">
		<h1 class="title">Logging out...</h1>
		<p class="message">Please wait while we sign you out</p>
		<div class="spinner"></div>
	</div>
	<script>
		// Force a complete page reload to break any Next.js caching
		setTimeout(() => {
			window.location.href = '/';
		}, 500);
	</script>
</body>
</html>`;

	const response = new NextResponse(html, {
		headers: {
			'Content-Type': 'text/html',
			'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
			Pragma: 'no-cache',
			Expires: '0',
		},
	});

	// Clear the session cookie using delete method
	response.cookies.delete({
		name: 'session',
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
	});

	return response;
}
