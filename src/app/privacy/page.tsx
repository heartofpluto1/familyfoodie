import { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Privacy Policy - Family Foodie',
	description: 'Privacy Policy for Family Foodie - How we collect, use, and protect your information',
};

export default function PrivacyPolicy() {
	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<h1 className="text-3xl mb-6">Privacy Policy</h1>
			<p className="text-sm text-muted mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

			<div className="space-y-8 text-foreground">
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-sm p-4 mb-8">
					<p className="text-sm">
						<strong>Beta Service Notice:</strong> Family Foodie is currently in beta. As we develop and improve our service, 
						our privacy practices may evolve. We will notify you of any significant changes to this policy. 
						During beta, we are actively collecting feedback to improve the service, and some features described in this policy may not yet be fully implemented.
					</p>
				</div>

				<section>
					<h2 className="text-2xl mb-4">1. Introduction</h2>
					<p className="mb-4">
						Welcome to Family Foodie (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your personal information and your right to privacy.
						This Privacy Policy describes how we collect, use, store, and share your information when you use our meal planning service.
					</p>
					<p>
						By using Family Foodie, you agree to the collection and use of information in accordance with this policy.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">2. Information We Collect</h2>
					<h3 className="text-xl mb-2">Information You Provide</h3>
					<ul className="list-disc pl-6 mb-4 space-y-2">
						<li><strong>Account Information:</strong> When you create an account, we collect your name, email address, and profile picture.</li>
						<li><strong>Profile Information:</strong> You may choose to provide additional information such as dietary preferences and household size.</li>
						<li><strong>Recipe Data:</strong> Information about recipes you save, meal plans you create, and shopping lists you generate.</li>
						<li><strong>Feedback:</strong> Any feedback, comments, or suggestions you provide to us.</li>
					</ul>

					<h3 className="text-xl mb-2">Information Collected Automatically</h3>
					<ul className="list-disc pl-6 mb-4 space-y-2">
						<li><strong>Usage Data:</strong> Information about how you interact with our service, including pages visited and features used.</li>
						<li><strong>Device Information:</strong> Browser type, operating system, and device type.</li>
						<li><strong>Cookies:</strong> We use cookies to maintain your session and remember your preferences.</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">3. Third-Party Services</h2>
					<p className="mb-4">We use the following third-party services that may collect or process your data:</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li><strong>Google OAuth:</strong> For authentication. Google provides us with your name, email, and profile picture.</li>
						<li><strong>Google Cloud Services:</strong> For hosting our application and storing recipe images and PDFs you upload.</li>
						<li><strong>OpenAI API:</strong> For AI-powered recipe import features (recipe data is processed but not stored by OpenAI).</li>
					</ul>
					<p>
						These services have their own privacy policies that govern their collection and use of data. We encourage you to review their policies.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">4. Legal Basis for Processing (GDPR)</h2>
					<p className="mb-4">If you are in the European Economic Area (EEA), we process your personal data based on the following legal grounds:</p>
					<ul className="list-disc pl-6 space-y-2">
						<li><strong>Consent:</strong> You have given consent for processing (e.g., for marketing communications)</li>
						<li><strong>Contract Performance:</strong> Processing is necessary to provide our services to you</li>
						<li><strong>Legitimate Interests:</strong> Processing is necessary for our legitimate business interests (e.g., improving our services, security)</li>
						<li><strong>Legal Obligations:</strong> Processing is necessary to comply with legal requirements</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">5. How We Use Your Information</h2>
					<p className="mb-4">We use your information to:</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>Provide, maintain, and improve our meal planning service</li>
						<li>Create and manage your account</li>
						<li>Save your recipes, meal plans, and shopping lists</li>
						<li>Personalize your experience and provide recipe recommendations</li>
						<li>Communicate with you about your account and our services</li>
						<li>Respond to your inquiries and provide customer support</li>
						<li>Analyze usage patterns to improve our service</li>
						<li>Ensure the security and integrity of our platform</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">6. Information Sharing and Disclosure</h2>
					<p className="mb-4">We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:</p>
					<ul className="list-disc pl-6 space-y-2">
						<li><strong>With Your Consent:</strong> We may share your information when you give us explicit permission.</li>
						<li><strong>Household Members:</strong> Meal plans and shopping lists may be shared with members you have invited to your household.</li>
						<li><strong>Service Providers:</strong> We may share information with trusted third-party service providers who assist us in operating our platform (e.g., hosting, analytics).</li>
						<li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights and safety.</li>
						<li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the successor entity.</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">7. Data Security</h2>
					<p className="mb-4">
						We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
						These measures include:
					</p>
					<ul className="list-disc pl-6 space-y-2">
						<li>Encryption of data in transit using HTTPS</li>
						<li>Authentication via secure OAuth with Google</li>
						<li>Regular security assessments and updates</li>
						<li>Limited access to personal information on a need-to-know basis</li>
					</ul>
					<p className="mt-4">
						However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">8. Data Breach Notification</h2>
					<p>
						In the event of a data breach that may affect your personal information, we will notify you and relevant authorities as required by law.
						Notification will be made without undue delay, typically within 72 hours of becoming aware of the breach, via email to your registered email address.
						The notification will include information about the nature of the breach, potential consequences, and measures taken to address it.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">9. User Content and Recipes</h2>
					<p className="mb-4">
						<strong>Your Content:</strong> You retain ownership of any recipes, meal plans, and other content you create or upload to Family Foodie.
						By using our service, you grant us a limited, non-exclusive license to store, display, and process your content solely for the purpose of providing our services to you.
					</p>
					<p className="mb-4">
						<strong>Shared Content:</strong> When you share recipes or meal plans with your household, those members can view and use that content.
						When you make your recipes public, they will be visible to all registered members of Family Foodie outside your household.
					</p>
					<p className="mb-4">
						<strong>Public Recipe Details:</strong> When you make a recipe public:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>Your name (as shown on your profile) will be displayed as the recipe creator</li>
						<li>Other users can view, save, and copy your recipe to their own collections</li>
						<li>The recipe creation date will be visible</li>
						<li>You can change a public recipe back to private at any time, but copies made by other users will remain in their accounts</li>
						<li>Public recipes may appear in search results and popular recipe listings</li>
					</ul>
					<p>
						<strong>Aggregated Data:</strong> We may use anonymized and aggregated data about popular recipes and meal planning trends to improve our service, but this will never identify you personally.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">10. Email Communications</h2>
					<p className="mb-4">We send the following types of emails:</p>
					<h3 className="text-xl mb-2">Transactional Emails (Cannot Unsubscribe)</h3>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>Welcome email when you create an account</li>
						<li>Invitations to join a household</li>
						<li>Important security or privacy updates</li>
						<li>Responses to your support requests</li>
					</ul>
					<p>
						Note that you cannot opt out of transactional emails as they are necessary for the service to function properly.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">11. Analytics and Tracking</h2>
					<p className="mb-4">We use analytics tools to understand how our service is used:</p>
					<ul className="list-disc pl-6 space-y-2">
						<li><strong>First-Party Analytics:</strong> We collect usage data directly to improve our service</li>
						<li><strong>Session Recording:</strong> We do not use session recording or screen capture tools</li>
						<li><strong>Do Not Track:</strong> We respect Do Not Track browser settings</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">12. Automated Decision-Making</h2>
					<p>
						We use automated systems to provide recipe recommendations and meal planning suggestions based on your preferences and history.
						These are suggestions only - you always have full control over your meal plans. We do not use automated decision-making for any purposes that would have legal or similarly significant effects on you.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">13. Data Retention</h2>
					<p>
						We retain your personal information for as long as your account is active or as needed to provide you with our services.
						If you close your account, we will delete or anonymize your personal information within 90 days, unless we are required to retain it for legal purposes.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">14. Your Rights and Choices</h2>
					<p className="mb-4">You have the following rights regarding your personal information:</p>
					<ul className="list-disc pl-6 space-y-2 mb-6">
						<li><strong>Access:</strong> You can request a copy of the personal information we have about you.</li>
						<li><strong>Correction:</strong> You can update or correct your information through your account settings.</li>
						<li><strong>Deletion:</strong> You can request that we delete your account and personal information.</li>
						<li><strong>Data Portability:</strong> You can request your data in a structured, machine-readable format.</li>
						<li><strong>Opt-out:</strong> You can opt-out of promotional communications by following the unsubscribe instructions in emails.</li>
						<li><strong>Restriction:</strong> You can request that we restrict processing of your personal data in certain circumstances.</li>
						<li><strong>Objection:</strong> You can object to processing of your personal data where we rely on legitimate interests.</li>
					</ul>

					<h3 className="text-xl mb-2">How to Exercise Your Rights</h3>
					<p className="mb-4">To exercise any of these rights:</p>
					<ol className="list-decimal pl-6 space-y-2 mb-4">
						<li><strong>Profile Updates:</strong> To update your profile information and preferences, email us at contact@familyfoodie.co with the subject line &quot;Profile Update Request&quot;.</li>
						<li><strong>Data Export:</strong> Email us at contact@familyfoodie.co with the subject line &quot;Data Export Request&quot; and we will provide your data within 30 days.</li>
						<li><strong>Account Deletion:</strong> Email us at contact@familyfoodie.co with the subject line &quot;Account Deletion Request&quot; from your registered email address.</li>
						<li><strong>Other Requests:</strong> For all other privacy rights requests, email us at contact@familyfoodie.co with a clear description of your request.</li>
					</ol>
					<p className="mb-4">
						<strong>Verification:</strong> To protect your privacy, we may need to verify your identity before processing your request. We will use your registered email address for verification.
					</p>
					<p className="mb-4">
						<strong>Response Time:</strong> We will respond to your request within 30 days. If we need more time (up to an additional 60 days), we will inform you of the reason and extension period.
					</p>

					<h3 className="text-xl mb-2">Complaints</h3>
					<p className="mb-4">
						If you have concerns about how we handle your personal information, please contact us first at contact@familyfoodie.co. 
						If you are not satisfied with our response, you have the right to lodge a complaint with:
					</p>
					<ul className="list-disc pl-6 space-y-2">
						<li><strong>Australian users:</strong> Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au</li>
						<li><strong>EU users:</strong> Your local data protection authority</li>
						<li><strong>UK users:</strong> Information Commissioner&apos;s Office (ICO) at ico.org.uk</li>
					</ul>
				</section>

				<section>
					<h2 className="text-2xl mb-4">15. Children&apos;s Privacy</h2>
					<p>
						Family Foodie is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
						If you are a parent or guardian and believe your child has provided us with personal information, please contact us so we can delete such information.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">16. International Data Transfers</h2>
					<p>
						Your information may be transferred to and processed in countries other than your own. These countries may have different data protection laws.
						By using our service, you consent to the transfer of your information to these countries.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">17. Changes to This Privacy Policy</h2>
					<p>
						We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page
						and updating the &quot;Last updated&quot; date. We encourage you to review this Privacy Policy periodically.
					</p>
				</section>

				<section>
					<h2 className="text-2xl mb-4">18. Contact Us</h2>
					<p className="mb-4">If you have any questions about this Privacy Policy or our privacy practices, please contact us at:</p>
					<div className="bg-surface p-4 rounded-sm border border-custom">
						<p>Family Foodie</p>
						<p>Email: contact@familyfoodie.co</p>
						<p>Address: PO BOX 3010, Murrumbeena, VIC 3163, Australia</p>
					</div>
				</section>

				<section className="mt-12 p-6 bg-surface rounded-sm border border-custom">
					<h2 className="text-xl mb-3">Cookie Policy</h2>
					<p className="mb-3">
						We use cookies and similar tracking technologies to track activity on our service and hold certain information.
						Cookies are files with a small amount of data which may include an anonymous unique identifier.
					</p>
					<p className="mb-3">You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our service.</p>
					<p>We use session cookies to maintain your login state and remember your preferences.</p>
				</section>
			</div>
		</div>
	);
}