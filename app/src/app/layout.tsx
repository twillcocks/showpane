import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Secure client portal powered by Showpane",
  robots: { index: false, follow: false },
};

function cloudEventsScript(): string | null {
  const url = process.env.CLOUD_EVENTS_URL;
  const token = process.env.CLOUD_EVENTS_TOKEN;
  if (!url) return null;
  // Escape for safe inline script injection
  const safeUrl = url.replace(/[\\'"<>&]/g, "");
  const safeToken = token ? token.replace(/[\\'"<>&]/g, "") : "";
  return `window.__SHOWPANE_CLOUD_EVENTS_URL__="${safeUrl}";window.__SHOWPANE_CLOUD_EVENTS_TOKEN__="${safeToken}";`;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const script = cloudEventsScript();
  return (
    <html lang="en">
      <body className={inter.className}>
        {script && (
          <script dangerouslySetInnerHTML={{ __html: script }} />
        )}
        {children}
      </body>
    </html>
  );
}
