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
        {/* FFBB gradient accent bar */}
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, #7B9AD4 0%, #D4888A 100%)",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
          }}
        />
        <div className="min-h-screen max-w-5xl mx-auto px-4 pt-10 pb-12">
          <header className="mb-10">
            <a href="/" className="flex items-center gap-2 w-fit group">
              <span className="text-xl select-none">🏀</span>
              <span
                className="font-semibold tracking-tight text-sm"
                style={{ color: "var(--foreground)" }}
              >
                FFBB Insights
              </span>
            </a>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
