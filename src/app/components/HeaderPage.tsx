type HeaderPageProps = {
	title: string;
	subtitle: string;
};

const HeaderPage = ({ title, subtitle }: HeaderPageProps) => {
	return (
		<>
			<h2 className="text-2xl text-foreground">{title}</h2>
			<p className="text-sm text-muted">{subtitle}</p>
		</>
	);
};

export default HeaderPage;
