import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "INTENT — Start with what matters.",
    template: "%s — INTENT",
  },
  description:
    "INTENT is a shared space where humans and AI can shape, question, and evolve the same intent before taking action.",
  applicationName: "INTENT",
  generator: "Next.js",
  keywords: [
    "INTENT",
    "intent interface",
    "human AI collaboration",
    "WebMCP",
    "AI interaction",
    "decision making",
    "context",
  ],
  authors: [
    {
      name: "INTENT",
    },
  ],
  creator: "INTENT",
  publisher: "INTENT",
  category: "technology",
  referrer: "origin-when-cross-origin",

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
    ],
  },

  openGraph: {
    title: "INTENT — Start with what matters.",
    description:
      "A shared space where humans and AI can shape, question, and evolve the same intent before taking action.",
    type: "website",
    siteName: "INTENT",
  },

  twitter: {
    card: "summary_large_image",
    title: "INTENT — Start with what matters.",
    description:
      "A shared space where humans and AI can shape, question, and evolve the same intent before taking action.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#f3f3ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>

        <div id="app-root">{children}</div>

        <noscript>
          <div className="noscript-message">
            <strong>INTENT needs JavaScript.</strong>
            <span>
              Enable JavaScript in your browser to use the interactive intent
              workspace.
            </span>
          </div>
        </noscript>
      </body>
    </html>
  );
}