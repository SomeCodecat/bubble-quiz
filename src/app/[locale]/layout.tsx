import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { SocketProvider } from "@/components/providers/socket-provider";
import { MusicProvider } from "@/components/providers/music-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { LayoutContent } from "@/components/layout/layout-content";
import { auth } from "@/lib/auth";
import { UIProvider } from "@/components/providers/ui-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bubble Quiz",
  description: "Real-time Multiplayer Quiz",
  icons: {
    icon: "/icon",
  },
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const session = await auth();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <SessionProvider session={session}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <SocketProvider>
                <MusicProvider>
                  <UIProvider>
                    <div className="flex h-screen overflow-hidden bg-background">
                      <LayoutContent>{children}</LayoutContent>
                    </div>
                    <Toaster />
                  </UIProvider>
                </MusicProvider>
              </SocketProvider>
            </ThemeProvider>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
