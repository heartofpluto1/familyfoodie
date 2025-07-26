import type { Metadata } from "next";
import "./globals.css";
import HeaderLogo from "./components/HeaderLogo";

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
        <HeaderLogo/>
        {children}
      </body>
    </html>
  );
}
