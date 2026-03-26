import type { Metadata } from "next";
import { SponsorPlacementSection } from "@/src/components/public/SponsorPlacementSection";
import "./globals.css";

export const metadata: Metadata = {
  title: "my-project",
  description: "Built with prd-to-prod",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer style={{ marginTop: "2rem", padding: "1rem", borderTop: "1px solid #ddd" }}>
          <SponsorPlacementSection />
        </footer>
      </body>
    </html>
  );
}
