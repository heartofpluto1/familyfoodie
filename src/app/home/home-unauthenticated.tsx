'use client';

import { IntroPlanIcon, IntroStatsIcon, IntroShoppingCartIcon } from '@/app/components/Icons';

export default function HomeUnauthenticated() {
	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-2xl mx-auto text-center">
					<div className="bg-surface border border-custom rounded-sm p-8 mb-8">
						<h2 className="text-xl text-foreground mb-4">Login to view your meal plans</h2>
						<p className="text-secondary mb-6">
							Access your personalized meal planning hub, view your recipe collection, and track your weekly meal stats.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
						<div className="bg-surface border border-custom rounded-sm p-6">
							<div className="text-accent mb-3">
								<IntroPlanIcon />
							</div>
							<h3 className="text-foreground mb-2">Plan Your Meals</h3>
							<p className="text-secondary text-sm">Organize your weekly meal plans and never wonder &ldquo;what&quot;s for dinner?&rdquo; again.</p>
						</div>

						<div className="bg-surface border border-custom rounded-sm p-6">
							<div className="text-accent mb-3">
								<IntroShoppingCartIcon />
							</div>
							<h3 className="text-foreground mb-2">Shopping Lists</h3>
							<p className="text-secondary text-sm">Automatically create shopping lists from your planned meals to save time.</p>
						</div>

						<div className="bg-surface border border-custom rounded-sm p-6">
							<div className="text-accent mb-3">
								<IntroStatsIcon />
							</div>
							<h3 className="text-foreground mb-2">Track Your Stats</h3>
							<p className="text-secondary text-sm">See your meal planning history and discover patterns in your favorite recipes.</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
