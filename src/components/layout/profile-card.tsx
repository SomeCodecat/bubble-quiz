"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProfileCard({ className }: { className?: string }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 animate-pulse">
        <div className="h-9 w-9 rounded-full bg-muted-foreground/20" />
        <div className="flex-1 space-y-1">
          <div className="h-3 w-20 bg-muted-foreground/20 rounded" />
          <div className="h-2 w-24 bg-muted-foreground/20 rounded" />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const { user } = session;
  const initial = (user.username || user.name || "U").charAt(0).toUpperCase();

  return (
    <div className={cn("group relative", className)}>
      <Link href="/profile" className="block">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/80 hover:border-border transition-all cursor-pointer">
          <div className="shrink-0">
            <UserAvatar user={user} className="h-9 w-9" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">
              {user.username || user.name || "User"}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {user.email}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
