import { Crimson_Text } from 'next/font/google';

const crimsonText = Crimson_Text({
	subsets: ['latin'],
	weight: ['400', '600', '700'],
	display: 'swap',
});

type HeaderPageProps = {
	title: string;
	subtitle: string;
};

const HeaderPage = ({ title, subtitle }: HeaderPageProps) => {
	return (
		<>
			<h2 className={`${crimsonText.className} text-2xl font-bold text-foreground`}>{title}</h2>
			<p className="text-sm text-muted">{subtitle}</p>
		</>
	);
};

export default HeaderPage;
