import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Foodie",
  description: "Shift left on meal planning and shopping lists",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20]">
          {children}
          <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
          </footer>
        </div>
      </body>
    </html>
  );
}
