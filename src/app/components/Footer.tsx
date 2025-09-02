import Link from 'next/link';

export default function Footer() {
	return (
		<footer className="border-t border-custom bg-surface mt-auto">
			<div className="container mx-auto px-4 py-6">
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
					<div className="flex items-center gap-4">
						<Link href="/terms" className="hover:text-foreground transition-colors">
							Terms of Service
						</Link>
						<Link href="/privacy" className="hover:text-foreground transition-colors">
							Privacy Policy
						</Link>
						<a href="mailto:contact@familyfoodie.co" className="hover:text-foreground transition-colors">
							Contact Us
						</a>
					</div>
					<div>
						© 2025 Family Foodie
					</div>
				</div>
			</div>
		</footer>
	);
}