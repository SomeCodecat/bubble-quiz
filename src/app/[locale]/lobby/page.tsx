"use client";

import { useSocket } from "@/components/providers/socket-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useSession, signOut, signIn } from "next-auth/react";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RegisterForm } from "@/components/auth/register-form";

export default function LobbyPage() {
  const { socket, isConnected, error } = useSocket();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const t = useTranslations("Lobby");

  useEffect(() => {
    const fetchLobbies = async () => {
      try {
        const res = await fetch("/api/lobbies");
        if (res.ok) {
          const data = await res.json();
          setLobbies(data);
        }
      } catch (error) {
        console.error("Failed to fetch lobbies", error);
      }
    };

    fetchLobbies();
    const interval = setInterval(fetchLobbies, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = () => {
    if (!roomCode) return;
    if (!socket) return;
    // ...
    router.push(`/room/${roomCode.toUpperCase()}`);
  };

  const handleCreate = () => {
    router.push("/pregame");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground transition-colors duration-300">
      {/* ... previous content ... */}
      <div className="absolute top-4 right-4 flex gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent drop-shadow-lg">
            {t("title")}
          </h1>
          <p className="text-muted-foreground font-medium">{t("subtitle")}</p>
        </div>

        <Card className="bg-card border-border shadow-2xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              {t("enterArena")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t("joinRoom")}
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder={t("placeholder")}
                  className="bg-background border-input text-foreground font-mono uppercase text-lg tracking-widest h-12"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  maxLength={6}
                />
                <Button
                  onClick={handleJoin}
                  disabled={!isConnected || !roomCode}
                  className="bg-primary text-primary-foreground font-bold h-12 w-24 transition-all"
                >
                  {t("join")}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t("or")}
                </span>
              </div>
            </div>

            {/* Authenticated Actions */}
            {status === "authenticated" ? (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleCreate}
                  className="w-full h-12 font-semibold"
                >
                  {t("create")}
                </Button>

                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => router.push("/questions")}
                    className="h-12 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {t("questions")}
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-2">
                  <p>
                    {t("loggedInAs")}{" "}
                    <Link
                      href="/profile"
                      className="font-bold text-primary hover:underline"
                    >
                      {session.user?.name || session.user?.email}
                    </Link>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => signOut()}
                    className="h-auto p-0 text-red-400 hover:text-red-500 hover:bg-transparent"
                  >
                    {t("signOut")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => signIn()}
                  className="h-12 font-semibold"
                >
                  {t("signIn")}
                </Button>

                <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      className="h-12 font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {t("register")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogTitle className="text-center text-xl font-bold">
                      Create Account
                    </DialogTitle>
                    <RegisterForm
                      onSuccess={() => {
                        setIsRegisterOpen(false);
                        signIn();
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {!isConnected && (
              <div className="text-center pt-2">
                <p className="text-xs text-red-500 animate-pulse">
                  {error ? `Error: ${error}` : "Connecting to Server..."}
                </p>
                {/* Optional Retry Button for user to trigger re-render or re-check */}
              </div>
            )}
          </CardContent>
        </Card>

        {lobbies.length > 0 && (
          <Card className="bg-card border-border shadow-2xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-center text-xl font-bold">
                Active Games
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lobbies.map((lobby) => (
                <div
                  key={lobby.code}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => router.push(`/room/${lobby.code}`)}
                >
                  <div>
                    <p className="font-bold font-mono">{lobby.code}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {lobby.phase}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {lobby.playerCount} Players
                    </span>
                    <Button size="sm" variant="secondary">
                      Join
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
