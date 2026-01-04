"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import {
  Gamepad2,
  Sparkles,
  Trophy,
  Lightbulb,
  Users,
  Activity,
  Database,
  Library,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { getLobbyStats } from "@/app/actions/game";

export default function LobbyPage() {
  const { data: session } = useSession();
  const t = useTranslations("Lobby");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    getLobbyStats().then(setStats);
    const interval = setInterval(() => {
      getLobbyStats().then(setStats);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      title: t("competeTitle"),
      desc: t("competeDesc"),
      icon: Trophy,
      color: "text-amber-500",
    },
    {
      title: t("createTitle"),
      desc: t("createDesc"),
      icon: Sparkles,
      color: "text-purple-500",
    },
    {
      title: t("learnTitle"),
      desc: t("learnDesc"),
      icon: Lightbulb,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="h-full flex flex-col p-6 lg:p-12 relative overflow-hidden bg-background">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Gamepad2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight uppercase italic underline decoration-indigo-500/50 underline-offset-8">
                {t("title")}
              </h1>
              <p className="text-muted-foreground font-medium">
                {t("subtitle")}
              </p>
            </div>
          </div>

          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold">
              {t("welcomeBack", {
                name:
                  session?.user?.username || session?.user?.name || "Player",
              })}
            </h2>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              {t("introText")}
              <span className="hidden sm:inline"> {t("sidebarHint")}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <Card
              key={card.title}
              className="bg-card/30 backdrop-blur-sm border-dashed hover:border-solid hover:bg-card/50 transition-all cursor-default group"
            >
              <CardContent className="p-6 space-y-4">
                <card.icon className={cn("h-8 w-8", card.color)} />
                <h3 className="font-bold text-lg">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {card.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Server Stats Section */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500 fill-amber-500/20" />
            <h2 className="text-xl font-bold tracking-tight uppercase">
              {t("statsTitle")}
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label={t("onlineNow")}
              value={stats?.online ?? "..."}
              icon={Activity}
              color="text-emerald-500"
            />
            <StatCard
              label={t("activeGames")}
              value={stats?.activeRooms ?? "..."}
              icon={Gamepad2}
              color="text-indigo-500"
            />
            <StatCard
              label={t("totalQuestions")}
              value={stats?.questions ?? "..."}
              icon={Database}
              color="text-blue-500"
            />
            <StatCard
              label={t("totalCollections")}
              value={stats?.collections ?? "..."}
              icon={Library}
              color="text-purple-500"
            />
            <StatCard
              label={t("totalUsers")}
              value={stats?.users ?? "..."}
              icon={Users}
              color="text-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: any;
  icon: any;
  color: string;
}) {
  return (
    <Card className="bg-card/20 backdrop-blur-none border-dashed border-muted-foreground/20">
      <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
        <Icon className={cn("h-4 w-4 mb-1", color)} />
        <p className="text-2xl font-black tabular-nums">{value}</p>
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

// Utility for className pairing if not imported
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
