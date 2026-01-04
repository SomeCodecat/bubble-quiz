"use client";

import { usePathname, Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { MusicControls } from "@/components/common/music-controls";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard,
  Layers,
  Settings,
  Gamepad2,
  LogOut,
  Plus,
  LogIn,
  UserPlus,
  ArrowRight,
  Circle,
  Users,
} from "lucide-react";
import { signOut, useSession, signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ProfileCard } from "./profile-card";
import { useState, useEffect } from "react";
import { User } from "next-auth";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { useRouter } from "@/i18n/routing";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  user?: User;
}

export function Sidebar({ className, user: initialUser }: SidebarProps) {
  const { data: session } = useSession();
  const user = session?.user || initialUser; // Prefer session (client up to date) but fallback to prop
  const isAdmin = user?.role === "ADMIN";

  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  const openAuth = (tab: "login" | "register") => {
    setAuthTab(tab);
    setIsAuthOpen(true);
  };

  const lobbyT = useTranslations("Lobby");
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [activeLobbies, setActiveLobbies] = useState<any[]>([]);

  // Poll for active lobbies
  useEffect(() => {
    const fetchLobbies = async () => {
      try {
        const res = await fetch("/api/lobbies");
        if (res.ok) {
          const data = await res.json();
          setActiveLobbies(data);
        }
      } catch (error) {
        console.error("Sidebar lobby fetch failed", error);
      }
    };
    fetchLobbies();
    const inv = setInterval(fetchLobbies, 8000);
    return () => clearInterval(inv);
  }, []);

  const handleJoin = (codeToJoin?: string) => {
    const finalCode = codeToJoin || roomCode;
    if (!finalCode) return;
    router.push(`/room/${finalCode.toUpperCase()}`);
    if (!codeToJoin) setRoomCode("");
  };

  const routes = user
    ? [
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
      ]
    : [];

  return (
    <div
      className={cn(
        "pb-12 h-screen border-r bg-muted/20 backdrop-blur-md flex flex-col",
        className
      )}
    >
      <div className="px-3 py-6 shrink-0">
        <Link href="/lobby">
          <h2 className="mb-2 px-4 text-2xl font-black tracking-tighter text-primary flex items-center gap-2">
            <span className="bg-gradient-to-br from-indigo-500 to-purple-600 w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-500/20">
              BQ
            </span>
            <span>BubbleQuiz</span>
          </h2>
        </Link>
        <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
          {t("subtitle")}
        </p>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-6 pb-6">
          {/* LOBBY SECTION */}
          <div className="space-y-3">
            <h3 className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Gamepad2 className="h-3 w-3" />
              {t("lobby")}
            </h3>

            <div className="bg-card/50 border rounded-xl p-3 space-y-3 shadow-sm">
              <div className="flex gap-1.5">
                <Input
                  placeholder="CODE"
                  className="h-9 font-mono uppercase tracking-widest text-xs bg-background/50"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  maxLength={6}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => handleJoin()}
                  disabled={!roomCode}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              {user && (
                <Button
                  variant="default"
                  className="w-full h-9 gap-2 font-bold shadow-md shadow-primary/10"
                  onClick={() => router.push("/pregame")}
                >
                  <Plus className="h-4 w-4" />
                  {lobbyT("create")}
                </Button>
              )}
            </div>

            {activeLobbies.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {activeLobbies.slice(0, 5).map((lobby) => (
                  <button
                    key={lobby.code}
                    onClick={() => handleJoin(lobby.code)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/80 border border-transparent hover:border-border transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Circle
                          className={cn(
                            "h-2 w-2 fill-current",
                            lobby.phase === "lobby"
                              ? "text-emerald-500"
                              : "text-amber-500"
                          )}
                        />
                        <div
                          className={cn(
                            "absolute inset-0 animate-ping h-full w-full rounded-full opacity-20",
                            lobby.phase === "lobby"
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                          )}
                        />
                      </div>
                      <span className="font-mono font-bold text-xs">
                        {lobby.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium bg-muted/30 px-2 py-0.5 rounded-full group-hover:bg-background">
                      <Users className="h-2.5 w-2.5" />
                      {lobby.playerCount}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MANAGMENT SECTION */}
          {user && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t("management")}
                </h3>
              </div>
              <div className="space-y-1">
                {routes.map((route) => (
                  <Link key={route.href} href={route.href}>
                    <Button
                      variant={route.active ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start h-10 gap-3 font-medium rounded-lg px-3 transition-all",
                        route.active
                          ? "bg-secondary/80 text-secondary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <route.icon className="h-4 w-4" />
                      {route.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* AUTH FOR GUESTS */}
          {!user && (
            <div className="space-y-3">
              <h3 className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {t("account")}
              </h3>
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  onClick={() => openAuth("login")}
                  className="w-full h-9 justify-start gap-3 text-xs font-bold transition-all text-muted-foreground hover:text-foreground border-dashed hover:border-solid hover:bg-primary/5 hover:text-primary"
                >
                  <LogIn className="h-4 w-4" />
                  {t("signIn")}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => openAuth("register")}
                  className="w-full h-9 justify-start gap-3 text-xs font-bold transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <UserPlus className="h-4 w-4" />
                  {t("register")}
                </Button>
              </div>
            </div>
          )}

          <AuthDialog
            isOpen={isAuthOpen}
            onOpenChange={setIsAuthOpen}
            defaultTab={authTab}
            key={authTab} // Force re-render on tab change to set default correctly
          />
        </div>
      </ScrollArea>

      <div className="px-3 py-4 mt-auto space-y-3 shrink-0">
        {user && (
          <div className="flex items-center gap-2">
            <ProfileCard className="flex-1" />
            {isAdmin && (
              <Link href="/admin" title={t("admin")}>
                <Button
                  variant={
                    pathname.includes("/admin") ? "secondary" : "outline"
                  }
                  size="icon"
                  className={cn(
                    "h-13 w-10 shrink-0 rounded-xl border-dashed hover:border-solid hover:bg-primary/5 hover:text-primary transition-all",
                    pathname.includes("/admin") &&
                      "bg-secondary/80 border-solid"
                  )}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-2 bg-card/50 backdrop-blur-sm p-1.5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-0.5">
            <MusicControls />
          </div>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        {user && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg h-9"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {lobbyT("signOut")}
          </Button>
        )}
      </div>
    </div>
  );
}
