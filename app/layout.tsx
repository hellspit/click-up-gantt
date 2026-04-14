import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClickUp Gantt Dashboard",
  description: "Visualize ClickUp tasks as a Gantt timeline per assignee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </body>
    </html>
  );
}
