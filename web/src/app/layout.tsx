import type { Metadata } from "next";
import "../styles/globals.css";
import { Providers } from "@/components/Providers";
import { DotGridBackground } from "@/components/DotGridBackground";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Vouch",
  description:
    "AI-curated, bond-backed copy trading on Arc. Every leader posts USDC. When they degrade, their bond slashes — not your deposit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col">
        <DotGridBackground />
        <Providers>
          <Nav />
          <main className="mx-auto w-full flex-1 px-6 md:px-10 py-12" style={{ maxWidth: 860 }}>
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
