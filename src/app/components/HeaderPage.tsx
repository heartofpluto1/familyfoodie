import { Crimson_Text } from "next/font/google";

const crimsonText = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

const HeaderPage = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <h2 className={`${crimsonText.className} text-2xl font-bold text-foreground mb-1`}>
    {children}
    </h2>
  );
};

export default HeaderPage;