"use client";

import { useSocket } from "@/components/providers/socket-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "@/i18n/routing";
import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

export default function PregamePage() {
  const { socket, isConnected } = useSocket();
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [status, setStatus] = useState("Connecting...");
  const hasCreatedRef = useRef(false);

  useEffect(() => {
    if (!socket) return;

    const onRoomCreated = ({ code }: { code: string }) => {
      router.push(`/room/${code}`);
    };

    socket.on("room:created", onRoomCreated);

    return () => {
      socket.off("room:created", onRoomCreated);
    };
  }, [socket, router]);

  useEffect(() => {
    if (
      isConnected &&
      socket &&
      !hasCreatedRef.current &&
      authStatus !== "loading"
    ) {
      hasCreatedRef.current = true;
      setStatus("Creating room...");

      let token = session?.user?.id;
      if (!token) {
        token = sessionStorage.getItem("bq_player_token") || "";
        if (!token) {
          if (typeof crypto !== "undefined" && crypto.randomUUID) {
            token = crypto.randomUUID();
          } else {
            token =
              Math.random().toString(36).substring(2) + Date.now().toString(36);
          }
          sessionStorage.setItem("bq_player_token", token);
        }
      }

      socket.emit("create_room", {
        playerToken: token,
        playerName: session?.user?.name || (session?.user as any)?.username,
        playerAvatar: session?.user?.image,
      });
    }
  }, [isConnected, socket, authStatus, session]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            Setting up Game
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-center text-muted-foreground font-medium animate-pulse">
            {status}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
