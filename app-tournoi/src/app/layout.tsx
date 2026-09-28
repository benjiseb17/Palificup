import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Palificup Tournoi",
  description: "Suis ta table en direct pendant le tournoi de Perudo Palificup.",
  // favicon.ico / icon.png / apple-icon.png in this folder are auto-detected
  // by Next.js — no need to declare them here.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-cream text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
