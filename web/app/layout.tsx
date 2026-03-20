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
        {/* Top accent bar */}
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, #A5273C 0%, #756585 50%, #352570 100%)",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
          }}
        />

        {/* Navbar */}
        <nav
          style={{
            position: "fixed",
            top: 3,
            left: 0,
            right: 0,
            zIndex: 40,
            background: "rgba(29, 36, 68, 0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(186, 172, 191, 0.12)",
          }}
        >
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <a href="/" className="flex items-center gap-3 w-fit group">
              <img
                src="/logo-2.jpg"
                alt="FFBB Simulation"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  objectFit: "cover",
                  boxShadow: "0 0 12px rgba(165, 39, 60, 0.4)",
                }}
              />
              <span
                className="font-semibold tracking-tight text-sm"
                style={{ color: "#FEFEFE" }}
              >
                FFBB Insights
              </span>
            </a>
          </div>
        </nav>

        <div className="min-h-screen max-w-5xl mx-auto px-4 pt-20 pb-12">
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
