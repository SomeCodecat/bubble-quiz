"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import {
  LayoutDashboard,
  Layers,
  User,
  Settings,
  Gamepad2,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ProfileCard } from "./profile-card";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isAdmin?: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
  };
}

export function Sidebar({ className, isAdmin, user }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("Sidebar");

  const routes = [
    {
      label: t("questions"),
      icon: LayoutDashboard,
      href: "/questions",
      active: pathname.includes("/questions"),
    },
    {
      label: t("collections"),
      icon: Layers,
      href: "/collections",
      active: pathname.includes("/collections"),
    },
    {
      label: t("game"),
      icon: Gamepad2,
      href: "/lobby",
      active: pathname?.includes("/lobby") || pathname?.includes("/room"),
    },
  ];

  if (isAdmin) {
    routes.push({
      label: t("admin"),
      icon: Settings,
      href: "/admin",
      active: pathname?.includes("/admin"),
    });
  }

  return (
    <div className={cn("pb-12 h-screen border-r bg-muted/10", className)}>
      <div className="space-y-4 py-4 flex flex-col h-full">
        <div className="px-3 py-2">
          <Link href="/questions">
            <h2 className="mb-2 px-4 text-lg font-bold tracking-tight text-primary flex items-center gap-2">
              <span className="bg-gradient-to-br from-indigo-500 to-purple-600 w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">
                BQ
              </span>
              BubbleQuiz
            </h2>
          </Link>
          <p className="px-4 text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="px-3 py-2 flex-1">
          <ScrollArea className="h-full px-1">
            <div className="space-y-1">
              {routes.map((route) => (
                <Link key={route.href} href={route.href}>
                  <Button
                    variant={route.active ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <route.icon className="mr-2 h-4 w-4" />
                    {route.label}
                  </Button>
                </Link>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="px-3 py-2 mt-auto space-y-2">
          <ProfileCard />

          <div className="flex items-center justify-between px-2 bg-card p-2 rounded-lg border shadow-sm">
            <ThemeToggle />
            <LanguageToggle />
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
