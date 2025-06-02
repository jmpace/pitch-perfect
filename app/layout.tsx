import "../styles/globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import ErrorBoundary from "@/components/error-boundary";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ErrorBoundary>
          <ThemeProvider>{children}</ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
} 