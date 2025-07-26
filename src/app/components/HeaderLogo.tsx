import Link from "next/link";
import { Crimson_Text } from "next/font/google";

const crimsonText = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

const HeaderLogo = () => {
  return (
    <header className="bg-surface border-b border-custom">
      <div className="container mx-auto px-4 py-6">
        {/* Title Section */}
        <div className="text-center">
          <h1 className={`${crimsonText.className} font-bold text-4xl md:text-5xl text-foreground mb-2 tracking-wide`}>
            Family Foodie
          </h1>
          <p className="text-lg text-muted font-light italic">
            What the fork is for dinner?
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex justify-center mt-4">
          <div className="flex space-x-8">
            <Link 
              href="/" 
              className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline"
            >
              Home
            </Link>
            <Link 
              href="/shopping" 
              className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline"
            >
              Shopping
            </Link>
            <Link 
              href="/menus" 
              className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline"
            >
              Menus
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default HeaderLogo;