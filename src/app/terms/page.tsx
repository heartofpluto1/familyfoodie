import { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Terms of Service - Family Foodie',
	description: 'Terms of Service for Family Foodie - The rules and agreements for using our meal planning service',
};

export default function TermsOfService() {
	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<h1 className="text-3xl mb-6">Terms of Service</h1>
			<p className="text-sm text-muted mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

			<div className="space-y-8 text-foreground">
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-sm p-4 mb-8">
					<p className="text-sm">
						<strong>Beta Service Notice:</strong> Family Foodie is currently in beta. Features and functionality may change, and there may be bugs or
						issues. We appreciate your patience and feedback as we improve the service.
					</p>
				</div>

				<section>
					<h2 className="text-2xl mb-4">1. Agreement to Terms</h2>
					<p className="mb-4">
						By accessing or using Family Foodie (&quot;Service&quot;), operated by Family Foodie (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you
						agree to be bound by these Terms of Service (&quot;Terms&quot;). If you disagree with any part of these terms, then you may not access the
						Service.
					</p>
					<p>These Terms apply to all visitors, users, and others who access or use the Service.</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">2. Description of Service</h2>
					<p className="mb-4">Family Foodie is a meal planning and recipe management service that allows users to:</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>Create and manage weekly meal plans</li>
						<li>Store and organize recipes</li>
						<li>Generate shopping lists</li>
						<li>Share recipes and meal plans with household members</li>
						<li>Access a collection of public recipes from other users</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">3. User Accounts</h2>
					<h3 className="text-xl mb-2">Account Creation</h3>
					<p className="mb-4">
						To use certain features of the Service, you must create an account using Google OAuth authentication. You are responsible for maintaining the
						confidentiality of your account and for all activities that occur under your account.
					</p>

					<h3 className="text-xl mb-2">Account Requirements</h3>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>You must be at least 13 years old to use this Service</li>
						<li>You must provide accurate and complete information</li>
						<li>You are responsible for all activity on your account</li>
						<li>You must notify us immediately of any unauthorized use of your account</li>
						<li>One person or legal entity may not maintain more than one free account</li>
					</ul>

					<h3 className="text-xl mb-2">Account Termination</h3>
					<p>
						We reserve the right to suspend or terminate your account at any time for any reason, including violation of these Terms. You may delete your
						account at any time by contacting us at contact@familyfoodie.co.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">4. Acceptable Use</h2>
					<p className="mb-4">You agree not to use the Service to:</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>Violate any laws or regulations</li>
						<li>Infringe upon the rights of others</li>
						<li>Upload or share content that is offensive, harmful, or inappropriate</li>
						<li>Spam, harass, or abuse other users</li>
						<li>Attempt to gain unauthorized access to the Service or other users&apos; accounts</li>
						<li>Use automated means (bots, scrapers, etc.) to access the Service</li>
						<li>Interfere with or disrupt the Service or servers</li>
						<li>Circumvent any content filtering or other security measures</li>
						<li>Use the Service for any commercial purpose without our permission</li>
						<li>Upload malicious code or viruses</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">5. User Content</h2>
					<h3 className="text-xl mb-2">Your Content</h3>
					<p className="mb-4">
						You retain ownership of any recipes, meal plans, images, and other content (&quot;User Content&quot;) you create or upload to the Service. By
						posting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your User
						Content solely for the purpose of operating and providing the Service.
					</p>

					<h3 className="text-xl mb-2">Public Recipes</h3>
					<p className="mb-4">
						When you make a recipe public, you grant all other users of the Service the right to view, copy, and use that recipe for their personal,
						non-commercial use. You understand that once a recipe is made public and copied by other users, you cannot revoke their copies even if you
						later make your recipe private.
					</p>

					<h3 className="text-xl mb-2">Content Standards</h3>
					<p className="mb-4">You represent and warrant that:</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>You own or have the necessary rights to your User Content</li>
						<li>Your User Content does not infringe any third-party rights</li>
						<li>Your User Content complies with these Terms and all applicable laws</li>
					</ul>

					<h3 className="text-xl mb-2">Content Removal</h3>
					<p>
						We reserve the right to remove any User Content that violates these Terms or that we find objectionable, without prior notice and at our sole
						discretion.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">6. Intellectual Property</h2>
					<p className="mb-4">
						The Service and its original content (excluding User Content), features, and functionality are and will remain the exclusive property of
						Family Foodie and its licensors. The Service is protected by copyright, trademark, and other laws. Our trademarks and trade dress may not be
						used in connection with any product or service without our prior written consent.
					</p>
					<p>
						Family Foodie respects the intellectual property rights of others. If you believe that any content on our Service violates your copyright,
						please contact us at contact@familyfoodie.co with details of the alleged infringement.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">7. Privacy</h2>
					<p>
						Your use of the Service is also governed by our Privacy Policy. Please review our{' '}
						<a href="/privacy" className="underline hover:text-foreground">
							Privacy Policy
						</a>
						, which also governs the Service and informs users of our data collection practices.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">8. Service Availability and Modifications</h2>
					<h3 className="text-xl mb-2">Beta Status</h3>
					<p className="mb-4">The Service is currently in beta. This means:</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>Features may be added, modified, or removed without notice</li>
						<li>The Service may experience downtime or errors</li>
						<li>Data loss may occur (though we will make reasonable efforts to prevent this)</li>
						<li>The Service may be discontinued at any time</li>
					</ul>

					<h3 className="text-xl mb-2">Service Changes</h3>
					<p className="mb-4">
						We reserve the right to withdraw or amend our Service, and any service or material we provide, in our sole discretion without notice. We will
						not be liable if for any reason all or any part of the Service is unavailable at any time or for any period.
					</p>

					<h3 className="text-xl mb-2">Maintenance</h3>
					<p>
						We may perform maintenance on the Service at any time, which may result in service interruptions. We will attempt to provide notice when
						possible, but are not obligated to do so.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">9. Third-Party Services</h2>
					<p className="mb-4">
						Our Service may contain links to third-party websites or services that are not owned or controlled by Family Foodie. We have no control over,
						and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services.
					</p>
					<p>
						The Service uses third-party services including Google OAuth for authentication and Google Cloud Services for hosting. Your use of these
						services is subject to their respective terms and policies.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">10. Disclaimer of Warranties</h2>
					<p className="mb-4">
						The Service is provided on an <strong>&quot;as is&quot;</strong> and <strong>&quot;as available&quot;</strong> basis. Family Foodie expressly
						disclaims all warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness
						for a particular purpose, and non-infringement.
					</p>
					<p className="mb-4">
						<strong>We do not warrant that:</strong>
					</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>The Service will function uninterrupted, secure, or error-free</li>
						<li>The results obtained from use of the Service will be accurate or reliable</li>
						<li>The quality of the Service will meet your expectations</li>
						<li>Any errors in the Service will be corrected</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">11. Limitation of Liability</h2>
					<p className="mb-4">
						<strong>To the maximum extent permitted by law</strong>, in no event shall Family Foodie, its officers, directors, employees, or agents be
						liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use,
						goodwill, or other intangible losses, resulting from:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>Your use or inability to use the Service</li>
						<li>Any unauthorized access to or use of our servers and/or any personal information stored therein</li>
						<li>Any interruption or cessation of transmission to or from the Service</li>
						<li>Any bugs, viruses, or the like that may be transmitted through the Service by any third party</li>
						<li>Any errors or omissions in any content or for any loss or damage incurred as a result of your use of any content</li>
						<li>The loss of any User Content or data</li>
					</ul>
					<p>
						<strong>In no event</strong> shall Family Foodie&apos;s total liability to you for all damages, losses, or causes of action exceed the amount
						you have paid Family Foodie in the last six (6) months, or, if greater, one hundred dollars ($100).
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">12. Indemnification</h2>
					<p>
						You agree to defend, indemnify, and hold harmless Family Foodie, its officers, directors, employees, and agents, from and against any claims,
						liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys&apos; fees) arising out of or
						relating to your violation of these Terms or your use of the Service, including, but not limited to, your User Content, any use of the
						Service&apos;s content, services, and products other than as expressly authorized in these Terms, or your use of any information obtained from
						the Service.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">13. Governing Law and Dispute Resolution</h2>
					<h3 className="text-xl mb-2">Governing Law</h3>
					<p className="mb-4">
						These Terms shall be governed and construed in accordance with the laws of Victoria, Australia, without regard to its conflict of law
						provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
					</p>

					<h3 className="text-xl mb-2">Dispute Resolution</h3>
					<p className="mb-4">
						Any dispute arising from these Terms or your use of the Service shall first be attempted to be resolved through good faith negotiation. If
						negotiation fails, disputes shall be resolved through binding arbitration in Melbourne, Victoria, Australia, except that you may assert claims
						in small claims court if your claims qualify.
					</p>

					<h3 className="text-xl mb-2">Class Action Waiver</h3>
					<p>
						You agree that any disputes will be resolved individually and not in a class, consolidated, or representative action. You may not bring a
						claim as a plaintiff or a class member in a class, consolidated, or representative action.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">14. Changes to Terms</h2>
					<p className="mb-4">
						We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at
						least 30 days notice prior to any new terms taking effect by posting the new Terms on this page and updating the &quot;Last updated&quot;
						date.
					</p>
					<p>By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms.</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">15. Severability</h2>
					<p>
						If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in
						effect. These Terms constitute the entire agreement between us regarding our Service and supersede and replace any prior agreements we might
						have had between us regarding the Service.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">16. Contact Information</h2>
					<p className="mb-4">If you have any questions about these Terms, please contact us at:</p>
					<div className="bg-surface p-4 rounded-sm border border-custom">
						<p>Family Foodie</p>
						<p>Email: contact@familyfoodie.co</p>
						<p>Address: PO BOX 3010, Murrumbeena, VIC 3163, Australia</p>
					</div>
				</section>

				<section className="mt-12 p-6 bg-surface rounded-sm border border-custom">
					<h2 className="text-xl mb-3">Acknowledgment</h2>
					<p>
						By using Family Foodie, you acknowledge that you have read and understood these Terms of Service and agree to be bound by them. If you do not
						agree to these Terms, please do not use our Service.
					</p>
				</section>
			</div>
		</div>
	);
}
