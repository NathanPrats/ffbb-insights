import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FFBB Insights",
  description: "Projections et analyses pour les championnats FFBB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="min-h-screen max-w-5xl mx-auto px-4 py-8">
          <header className="mb-10">
            <a href="/" className="text-sm font-mono" style={{ color: "var(--muted)" }}>
              ← FFBB Insights
            </a>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
