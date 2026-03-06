import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { AppStartupSplash } from "@/components/app-startup-splash";
import { VerificationGate } from "@/components/verification-gate";
import { ProductTour } from "@/components/product-tour";

export const metadata: Metadata = {
  title: "CoResearch - Collaborative Research Platform",
  description:
    "A web-based collaborative research space for university students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppStartupSplash />
        <AuthProvider>
          <VerificationGate />
          <ProductTour />
          <main className="min-h-screen">{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
