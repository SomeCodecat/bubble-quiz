"use client";

import { useSocket } from "@/components/providers/socket-provider";
import { UserAvatar } from "@/components/common/user-avatar";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ghost, Pause, Play, SkipForward } from "lucide-react";
import clsx from "clsx";
import { RoomState } from "@/lib/game/types";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { calculateNewDistribution } from "@/lib/distribution";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  List,
  Tag,
  Eye,
  Search,
  ArrowUpAZ,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from "lucide-react";

interface PageProps {
  params: Promise<{ code: string }>;
}

interface RoomClientProps {
  code: string;
  collections: {
    id: string;
    name: string;
    description: string | null;
    creator: { name: string | null; username: string | null };
    _count: { questions: number };
  }[];
  tags: { id: string; name: string; _count: { questions: number } }[];
  userId?: string;
  userName?: string;
  userAvatar?: string;
}

export default function RoomClient({
  code,
  collections,
  tags,
  userId,
  userName,
  userAvatar,
}: RoomClientProps) {
  const { socket, isConnected } = useSocket();
  const router = useRouter();
  const t = useTranslations("Room");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myToken, setMyToken] = useState<string>("");
  const [disabledOptions, setDisabledOptions] = useState<number[]>([]);
  const [spyActive, setSpyActive] = useState(false);
  const [enemySpyActive, setEnemySpyActive] = useState(false);
  const [jokerUser, setJokerUser] = useState<string | null>(null);
  const [jokerType, setJokerType] = useState<string | null>(null);
  const [jokerUserToken, setJokerUserToken] = useState<string | null>(null);
  const [playerToken, setPlayerToken] = useState<string>("");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const [progress, setProgress] = useState(100);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!room) return;

    const updateTimer = () => {
      if (room.phase === "question") {
        const duration = 30 * 1000; // Fixed 30s duration
        let remaining = 0;

        // Robust check: if pauseRemaining is set, treat as paused even if room.paused is falsy
        const isPaused = room.paused || room.pauseRemaining !== undefined;

        if (isPaused && room.pauseRemaining !== undefined) {
          remaining = room.pauseRemaining;
        } else if (room.qDeadlineTs) {
          remaining = Math.max(0, room.qDeadlineTs - Date.now());
        }

        const percent = Math.min(
          100,
          Math.max(0, (remaining / duration) * 100)
        );

        setProgress(percent);

        if (!isPaused && remaining > 0) {
          rafRef.current = requestAnimationFrame(updateTimer);
        }
      } else {
        setProgress(100);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    updateTimer();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [room?.phase, room?.qDeadlineTs, room?.paused, room?.pauseRemaining]);

  // Guest State
  const [guestName, setGuestName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    // Initialize Player Token
    let token = userId; // Use userId if logged in
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
    setPlayerToken(token);
  }, [userId]);

  // Host Config State
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState("30");
  const [tagSearch, setTagSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [collectionSort, setCollectionSort] = useState<{
    key: "alpha" | "count";
    dir: "asc" | "desc";
  }>({ key: "count", dir: "desc" });
  const [tagSort, setTagSort] = useState<{
    key: "alpha" | "count";
    dir: "asc" | "desc";
  }>({ key: "count", dir: "desc" });
  const [ratioStrategy, setRatioStrategy] = useState<
    "by_collection" | "consistent" | "custom"
  >("by_collection");
  const [customRatios, setCustomRatios] = useState<Record<string, number>>({});
  const [customDistMode, setCustomDistMode] = useState<"count" | "percent">(
    "count"
  );
  // Force re-run effect helper
  const [triggerEqualize, setTriggerEqualize] = useState(0);

  // Track active input for deferred updates (ID -> temporary value)
  const [activeInput, setActiveInput] = useState<{
    id: string;
    value: string;
  } | null>(null);

  // Calculate max questions available based on selection
  const maxAvailable =
    selectedCollections.reduce((acc, id) => {
      const col = collections.find((c) => c.id === id);
      return acc + (col?._count.questions || 0);
    }, 0) +
    selectedTags.reduce((acc, id) => {
      const tag = tags.find((t) => t.id === id);
      return acc + (tag?._count.questions || 0);
    }, 0);

  useEffect(() => {
    if (maxAvailable > 0) {
      const current = parseInt(totalQuestions) || 0;
      if (current > maxAvailable) {
        setTotalQuestions(maxAvailable.toString());
      }
    }
  }, [maxAvailable, totalQuestions]);

  // Auto-equalize when selections change in percent mode
  useEffect(() => {
    if (ratioStrategy === "custom" && customDistMode === "percent") {
      const hasTags = selectedTags.length > 0;
      const topLevelItems = selectedCollections.length + (hasTags ? 1 : 0);
      if (topLevelItems === 0) return;

      const topShare = Math.floor(100 / topLevelItems);
      // Distribute remainder to first item to ensure 100%
      const topRemainder = 100 - topShare * topLevelItems;

      const newRatios: Record<string, number> = {};

      selectedCollections.forEach((id, idx) => {
        newRatios[id] = topShare + (idx === 0 ? topRemainder : 0);
      });

      if (hasTags) {
        newRatios["_TAGS_TOTAL_"] =
          topShare + (selectedCollections.length === 0 ? topRemainder : 0);

        const tagShare = Math.floor(100 / selectedTags.length);
        const tagRemainder = 100 - tagShare * selectedTags.length;

        selectedTags.forEach((id, idx) => {
          newRatios[id] = tagShare + (idx === 0 ? tagRemainder : 0);
        });
      }

      setCustomRatios(newRatios);
    }
  }, [
    selectedCollections.length,
    selectedTags.length,
    ratioStrategy,
    customDistMode,
    triggerEqualize,
  ]);

  // Helper to adjust distribution proportionally using Largest Remainder Method
  const adjustDistribution = (
    changedId: string,
    newValue: number,
    group: "top" | "tags"
  ) => {
    setCustomRatios((prev) =>
      calculateNewDistribution(
        changedId,
        newValue,
        group,
        prev,
        selectedCollections,
        selectedTags,
        customDistMode
      )
    );
  };

  const currentTotal = parseInt(totalQuestions) || 0;
  const totalAssigned =
    selectedCollections.reduce((acc, id) => acc + (customRatios[id] || 0), 0) +
    selectedTags.reduce((acc, id) => acc + (customRatios[id] || 0), 0);
  const questionsLeft = currentTotal - totalAssigned;

  const handleStartGame = () => {
    if (!socket) return;
    // Validate
    if (selectedCollections.length === 0 && selectedTags.length === 0) {
      alert(t("selectError"));
      return;
    }

    const finalTotalQuestions = Math.min(
      parseInt(totalQuestions) > 0 ? parseInt(totalQuestions) : 30,
      maxAvailable
    );

    let backendRatios = customRatios;

    if (ratioStrategy === "custom" && customDistMode === "percent") {
      backendRatios = {};

      // Process Collections
      selectedCollections.forEach((id) => {
        const pct = customRatios[id] || 0;
        backendRatios[id] = Math.floor((pct / 100) * finalTotalQuestions);
      });

      // Process Tags
      if (selectedTags.length > 0) {
        const tagsTotalPct = customRatios["_TAGS_TOTAL_"] || 0;
        const tagsTotalCount = Math.floor(
          (tagsTotalPct / 100) * finalTotalQuestions
        );

        selectedTags.forEach((id) => {
          const tagPct = customRatios[id] || 0;
          backendRatios[id] = Math.floor((tagPct / 100) * tagsTotalCount);
        });
      }
    }

    const config = {
      collectionIds: selectedCollections,
      tagIds: selectedTags,
      totalQuestions: finalTotalQuestions,
      ratioStrategy,
      customRatios: backendRatios,
    };
    socket.emit("start_game", { code, config });
  };

  const joinRoom = (name: string, avatar?: string) => {
    if (!socket || !playerToken) return;
    socket.emit("join_room", { code, name, avatar, playerToken });
    setHasJoined(true);
  };

  useEffect(() => {
    if (!socket || !isConnected || !playerToken) return;

    // Auto-join if logged in
    if (userId && !hasJoined) {
      joinRoom(userName || "Player", userAvatar);
    }

    // ... existing listeners ...
    socket.on("room:update", (data: { room: RoomState }) => {
      setRoom(data.room);
      if (
        data.room.phase === "question" &&
        (!room || room.questionIndex !== data.room.questionIndex)
      ) {
        setDisabledOptions([]);
        setSpyActive(false);
        setEnemySpyActive(false);
        setJokerUser(null);
        setJokerType(null);
        setJokerUserToken(null);
        setSelectedAnswer(null);
      }
    });

    socket.on(
      "joker_triggered",
      (data: { playerToken: string; playerName: string; type: string }) => {
        console.log("Joker triggered:", data, "My token:", playerToken);
        toast.info(`${data.playerName} used ${data.type} Joker!`);
        setJokerUser(data.playerName);
        setJokerType(data.type);
        setJokerUserToken(data.playerToken);
        if (data.type === "spy" && data.playerToken !== playerToken) {
          console.log("Setting enemy spy active");
          setEnemySpyActive(true);
        }
      }
    );

    socket.on(
      "joker_effect",
      (data: { type: string; remove?: number[]; message?: string }) => {
        if (data.type === "5050" && data.remove) {
          setDisabledOptions(data.remove);
        }
        if (data.type === "spy") {
          setSpyActive(true);
        }
      }
    );

    socket.on("error", (msg: string) => {
      toast.error(msg);
      if (msg === "Room not found") {
        router.push("/");
      }
    });

    socket.on("room:deleted", () => {
      toast.error("Room has been deleted by the host.");
      router.push("/");
    });

    setMyToken(socket.id || "");

    return () => {
      socket.off("room:update");
      socket.off("joker_triggered");
      socket.off("joker_effect");
      socket.off("error");
      socket.off("room:deleted");
    };
  }, [
    socket,
    isConnected,
    code,
    router,
    room?.questionIndex,
    userId,
    hasJoined,
    playerToken,
  ]);

  if (!isConnected)
    return <div className="text-white p-10">{t("waiting")}...</div>;

  // Guest Join Screen
  if (!userId && !hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              {t("joinRoomTitle", { code })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("enterName")}</Label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t("guestPlaceholder")}
                maxLength={15}
              />
            </div>
            <Button
              className="w-full"
              onClick={() =>
                joinRoom(
                  guestName ||
                    `${t("guestPlaceholder")} ${Math.floor(
                      Math.random() * 1000
                    )}`
                )
              }
            >
              {t("joinGame")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!room)
    return <div className="text-white p-10">Loading Room {code}...</div>;

  const isHost = room.hostToken === playerToken;
  const isPaused = room.paused || room.pauseRemaining !== undefined;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col items-center">
      {/* Header / StatusBar */}
      <div className="w-full max-w-[95%] flex justify-between items-center bg-card p-4 rounded-xl border border-border mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary px-3 py-1 rounded font-bold text-primary-foreground">
            {code}
          </div>
          <div className="text-muted-foreground text-sm">
            {t("round")} {room.questionIndex + 1}/
            {room.phase === "lobby"
              ? totalQuestions
              : room.config?.totalQuestions || 30}
          </div>
        </div>
        <div className="text-xl font-bold tracking-widest text-center">
          {room.phase === "lobby" && t("waiting")}
          {room.phase === "question" && t("answerNow")}
          {room.phase === "reveal" && t("results")}
        </div>
        <div className="flex gap-2 items-center">
          <ThemeToggle />
          {isHost && (room.phase === "question" || room.phase === "reveal") && (
            <>
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  socket?.emit(isPaused ? "resume_timer" : "pause_timer", {
                    code,
                  })
                }
                title={isPaused ? "Resume" : "Pause"}
              >
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => socket?.emit("skip_phase", { code })}
                title="Next / Skip"
              >
                <SkipForward size={16} />
              </Button>
            </>
          )}
          {isHost && room.phase === "lobby" && (
            // Replaced Start Button with Config Panel Trigger or Inline
            <div className="bg-green-600 px-3 py-2 rounded text-white font-bold">
              {t("configureBelow")}
            </div>
          )}
          {isHost && room.phase === "finished" && (
            <Button onClick={() => router.push("/")} variant="destructive">
              {t("endGame")}
            </Button>
          )}
        </div>
      </div>

      <div className="w-full max-w-[95%] grid grid-cols-12 gap-6">
        {/* Main Stage (Question / Results) */}
        <div className="col-span-8 space-y-6">
          {room.phase === "lobby" && (
            <Card className="bg-card border-border min-h-[400px]">
              <CardHeader>
                <CardTitle className="text-center">
                  {t("hostWaiting")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isHost ? (
                  <div className="text-center py-10 space-y-4">
                    <Ghost
                      size={64}
                      className="mx-auto text-muted-foreground animate-bounce"
                    />
                    <p className="text-muted-foreground">
                      Waiting for host to configure and start the game...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4 border p-4 rounded-lg flex flex-col">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="font-bold flex items-center gap-2">
                            <List size={18} />
                            {t("config.selectCollections")}
                          </h3>
                          <Badge variant="secondary">
                            {selectedCollections.length}
                          </Badge>
                        </div>

                        <div className="flex-1 flex flex-col justify-between gap-4">
                          <div className="text-sm text-muted-foreground">
                            {selectedCollections.length === 0 ? (
                              <span className="italic">
                                {t("config.noCollections")}
                              </span>
                            ) : (
                              <ul className="list-disc list-inside">
                                {selectedCollections.slice(0, 3).map((id) => {
                                  const c = collections.find(
                                    (x) => x.id === id
                                  );
                                  return (
                                    <li key={id} className="truncate">
                                      <span className="font-medium">
                                        {c?.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-1">
                                        - by{" "}
                                        {c?.creator.name ||
                                          c?.creator.username ||
                                          "Unknown"}
                                      </span>
                                    </li>
                                  );
                                })}
                                {selectedCollections.length > 3 && <li>...</li>}
                              </ul>
                            )}
                          </div>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full">
                                Select Collections
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                              <DialogHeader>
                                <DialogTitle>
                                  {t("config.selectCollections")}
                                </DialogTitle>
                                <DialogDescription>
                                  Choose which question collections to include
                                  in the game.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="px-1 mt-2 flex gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Search collections..."
                                    value={collectionSearch}
                                    onChange={(e) =>
                                      setCollectionSearch(e.target.value)
                                    }
                                    className="pl-8"
                                  />
                                </div>
                                <div className="flex bg-muted rounded-md p-1 gap-1 border">
                                  <Button
                                    size="sm"
                                    variant={
                                      collectionSort.key === "alpha"
                                        ? "secondary"
                                        : "ghost"
                                    }
                                    className="w-8 h-8 p-0"
                                    onClick={() =>
                                      setCollectionSort((prev) => ({
                                        key: "alpha",
                                        dir:
                                          prev.key === "alpha" &&
                                          prev.dir === "asc"
                                            ? "desc"
                                            : "asc",
                                      }))
                                    }
                                    title="Sort Alphabetically"
                                  >
                                    {collectionSort.key === "alpha" &&
                                    collectionSort.dir === "desc" ? (
                                      <ArrowDownAZ size={16} />
                                    ) : (
                                      <ArrowUpAZ size={16} />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      collectionSort.key === "count"
                                        ? "secondary"
                                        : "ghost"
                                    }
                                    className="w-8 h-8 p-0"
                                    onClick={() =>
                                      setCollectionSort((prev) => ({
                                        key: "count",
                                        dir:
                                          prev.key === "count" &&
                                          prev.dir === "desc"
                                            ? "asc"
                                            : "desc",
                                      }))
                                    }
                                    title="Sort by Count"
                                  >
                                    {collectionSort.key === "count" &&
                                    collectionSort.dir === "asc" ? (
                                      <ArrowUpNarrowWide size={16} />
                                    ) : (
                                      <ArrowDownWideNarrow size={16} />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <ScrollArea className="h-[60vh] border rounded-md p-2 mt-4">
                                <div className="space-y-2">
                                  {collections
                                    .filter((col) =>
                                      col.name
                                        .toLowerCase()
                                        .includes(
                                          collectionSearch.toLowerCase()
                                        )
                                    )
                                    .sort((a, b) => {
                                      const dir =
                                        collectionSort.dir === "asc" ? 1 : -1;
                                      if (collectionSort.key === "alpha") {
                                        return (
                                          a.name.localeCompare(b.name) * dir
                                        );
                                      }
                                      return (
                                        (a._count.questions -
                                          b._count.questions) *
                                        dir
                                      );
                                    })
                                    .map((col) => (
                                      <div
                                        key={col.id}
                                        className="flex items-center justify-between gap-2 p-2 hover:bg-accent rounded-sm border"
                                      >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <Checkbox
                                            id={`col-d-${col.id}`}
                                            checked={selectedCollections.includes(
                                              col.id
                                            )}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setSelectedCollections([
                                                  ...selectedCollections,
                                                  col.id,
                                                ]);
                                              } else {
                                                setSelectedCollections(
                                                  selectedCollections.filter(
                                                    (id) => id !== col.id
                                                  )
                                                );
                                              }
                                            }}
                                          />
                                          <Label
                                            htmlFor={`col-d-${col.id}`}
                                            className="flex flex-1 items-center justify-between cursor-pointer min-w-0 gap-2"
                                          >
                                            <div className="flex flex-col min-w-0 gap-0.5">
                                              <span className="text-sm font-medium truncate">
                                                {col.name}
                                              </span>
                                              {col.description && (
                                                <span className="text-xs text-muted-foreground line-clamp-2 leading-tight mb-1">
                                                  {col.description}
                                                </span>
                                              )}
                                              <span className="text-[10px] text-muted-foreground/80 truncate">
                                                by{" "}
                                                {col.creator.name ||
                                                  col.creator.username ||
                                                  "Unknown"}
                                              </span>
                                            </div>
                                            <Badge
                                              variant="secondary"
                                              className="text-xs shrink-0"
                                            >
                                              {col._count.questions}
                                            </Badge>
                                          </Label>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={(e) => {
                                              e.stopPropagation(); // Prevent toggling selection
                                              window.open(
                                                `/collections/${col.id}`,
                                                "_blank"
                                              );
                                            }}
                                            title="View Collection"
                                          >
                                            <Eye size={16} />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  {collections.length === 0 && (
                                    <p className="text-center py-8 text-muted-foreground">
                                      No collections available.
                                    </p>
                                  )}
                                </div>
                              </ScrollArea>
                              <div className="text-xs text-muted-foreground text-center pt-2">
                                {selectedCollections.length} selected
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>

                      <div className="space-y-4 border p-4 rounded-lg flex flex-col">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="font-bold flex items-center gap-2">
                            <Tag size={18} />
                            {t("config.selectTags")}
                          </h3>
                          <Badge variant="secondary">
                            {selectedTags.length}
                          </Badge>
                        </div>

                        <div className="flex-1 flex flex-col justify-between gap-4">
                          <div className="text-sm text-muted-foreground">
                            {selectedTags.length === 0 ? (
                              <span className="italic">
                                {t("config.noTags")}
                              </span>
                            ) : (
                              <ul className="list-disc list-inside">
                                {selectedTags.slice(0, 3).map((id) => {
                                  const t = tags.find((x) => x.id === id);
                                  return (
                                    <li key={id} className="truncate">
                                      {t?.name}
                                    </li>
                                  );
                                })}
                                {selectedTags.length > 3 && <li>...</li>}
                              </ul>
                            )}
                          </div>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full">
                                Select Tags
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
                              <DialogHeader>
                                <DialogTitle>
                                  {t("config.selectTags")}
                                </DialogTitle>
                                <DialogDescription>
                                  Filter questions by specific tags.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="px-1 mt-2 flex gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Search tags..."
                                    value={tagSearch}
                                    onChange={(e) =>
                                      setTagSearch(e.target.value)
                                    }
                                    className="pl-8"
                                  />
                                </div>
                                <div className="flex bg-muted rounded-md p-1 gap-1 border">
                                  <Button
                                    size="sm"
                                    variant={
                                      tagSort.key === "alpha"
                                        ? "secondary"
                                        : "ghost"
                                    }
                                    className="w-8 h-8 p-0"
                                    onClick={() =>
                                      setTagSort((prev) => ({
                                        key: "alpha",
                                        dir:
                                          prev.key === "alpha" &&
                                          prev.dir === "asc"
                                            ? "desc"
                                            : "asc",
                                      }))
                                    }
                                    title="Sort Alphabetically"
                                  >
                                    {tagSort.key === "alpha" &&
                                    tagSort.dir === "desc" ? (
                                      <ArrowDownAZ size={16} />
                                    ) : (
                                      <ArrowUpAZ size={16} />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      tagSort.key === "count"
                                        ? "secondary"
                                        : "ghost"
                                    }
                                    className="w-8 h-8 p-0"
                                    onClick={() =>
                                      setTagSort((prev) => ({
                                        key: "count",
                                        dir:
                                          prev.key === "count" &&
                                          prev.dir === "desc"
                                            ? "asc"
                                            : "desc",
                                      }))
                                    }
                                    title="Sort by Count"
                                  >
                                    {tagSort.key === "count" &&
                                    tagSort.dir === "asc" ? (
                                      <ArrowUpNarrowWide size={16} />
                                    ) : (
                                      <ArrowDownWideNarrow size={16} />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <ScrollArea className="h-[60vh] border rounded-md p-2 mt-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {tags
                                    .filter((tag) =>
                                      tag.name
                                        .toLowerCase()
                                        .includes(tagSearch.toLowerCase())
                                    )
                                    .sort((a, b) => {
                                      const dir =
                                        tagSort.dir === "asc" ? 1 : -1;
                                      if (tagSort.key === "alpha") {
                                        return (
                                          a.name.localeCompare(b.name) * dir
                                        );
                                      }
                                      return (
                                        (a._count.questions -
                                          b._count.questions) *
                                        dir
                                      );
                                    })
                                    .map((tag) => (
                                      <div
                                        key={tag.id}
                                        className="flex items-center justify-between gap-2 p-2 hover:bg-accent rounded-sm border"
                                      >
                                        <div className="flex items-center gap-2 flex-1">
                                          <Checkbox
                                            id={`tag-d-${tag.id}`}
                                            checked={selectedTags.includes(
                                              tag.id
                                            )}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setSelectedTags([
                                                  ...selectedTags,
                                                  tag.id,
                                                ]);
                                              } else {
                                                setSelectedTags(
                                                  selectedTags.filter(
                                                    (id) => id !== tag.id
                                                  )
                                                );
                                              }
                                            }}
                                          />
                                          <Label
                                            htmlFor={`tag-d-${tag.id}`}
                                            className="flex flex-1 items-center justify-between cursor-pointer min-w-0 gap-2"
                                          >
                                            <span className="text-sm font-medium truncate">
                                              {tag.name}
                                            </span>
                                            <Badge
                                              variant="secondary"
                                              className="text-xs shrink-0"
                                            >
                                              {tag._count.questions}
                                            </Badge>
                                          </Label>
                                        </div>
                                      </div>
                                    ))}
                                  {tags.length === 0 && (
                                    <p className="text-center py-8 text-muted-foreground">
                                      No tags available.
                                    </p>
                                  )}
                                </div>
                              </ScrollArea>
                              <div className="text-xs text-muted-foreground text-center pt-2">
                                {selectedTags.length} selected
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 space-y-4 border p-4 rounded-lg">
                        <h3 className="font-bold border-b pb-2">
                          {t("config.gameSettings")}
                        </h3>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            {t("config.totalQuestions")}
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={totalQuestions}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Allow empty or numeric string
                                if (val === "" || /^\d+$/.test(val)) {
                                  let numStr = val;
                                  if (val !== "" && maxAvailable > 0) {
                                    const num = parseInt(val);
                                    if (num > maxAvailable) {
                                      numStr = maxAvailable.toString();
                                    }
                                  }
                                  setTotalQuestions(numStr);
                                }
                              }}
                              className="w-24 text-center"
                            />
                            <span className="text-xs text-muted-foreground">
                              {t("config.max", { max: maxAvailable })}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            {t("config.distribution")}
                          </label>
                          <RadioGroup
                            value={ratioStrategy}
                            onValueChange={(val: any) => setRatioStrategy(val)}
                            className="flex flex-col gap-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="by_collection"
                                id="r-collection"
                              />
                              <Label htmlFor="r-collection">
                                {t("config.distCollection")}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="consistent"
                                id="r-consistent"
                              />
                              <Label htmlFor="r-consistent">
                                {t("config.distConsistent")}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="custom" id="r-custom" />
                              <Label htmlFor="r-custom">
                                {t("config.distCustom")}
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {ratioStrategy === "custom" && (
                          <div className="space-y-6 mt-4 p-4 border rounded-xl bg-card shadow-sm">
                            {selectedCollections.length === 0 &&
                            selectedTags.length === 0 ? (
                              <div className="text-center text-muted-foreground italic py-4">
                                {t("config.customHelp")}
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-center mb-4">
                                  <div className="flex bg-muted/50 rounded-lg p-1 w-fit">
                                    <Button
                                      size="sm"
                                      variant={
                                        customDistMode === "count"
                                          ? "secondary"
                                          : "ghost"
                                      }
                                      className="h-7 w-8 px-0 text-xs rounded-md"
                                      onClick={() => {
                                        setCustomDistMode("count");
                                        setCustomRatios({});
                                      }}
                                    >
                                      #
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={
                                        customDistMode === "percent"
                                          ? "secondary"
                                          : "ghost"
                                      }
                                      className="h-7 w-8 px-0 text-xs rounded-md"
                                      onClick={() => {
                                        setCustomDistMode("percent");
                                        setTriggerEqualize((prev) => prev + 1);
                                      }}
                                    >
                                      %
                                    </Button>
                                  </div>
                                  {customDistMode === "count" && (
                                    <div
                                      className={clsx(
                                        "text-sm font-bold px-2 py-1 rounded",
                                        questionsLeft === 0
                                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      )}
                                    >
                                      {t("config.questionsLeft", {
                                        n: questionsLeft,
                                      })}
                                    </div>
                                  )}
                                </div>
                                {/* Collections Section */}
                                {selectedCollections.map((id) => {
                                  const collection = collections.find(
                                    (c) => c.id === id
                                  );
                                  if (!collection) return null;
                                  const isFocused = activeInput?.id === id;
                                  const displayValue = isFocused
                                    ? activeInput.value
                                    : customRatios[id] !== undefined
                                    ? customRatios[id]
                                    : "";

                                  return (
                                    <div key={id} className="space-y-2">
                                      <div className="flex items-center justify-between gap-2 text-sm font-medium">
                                        <span className="truncate flex-1 min-w-[120px]">
                                          {collection.name}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <Input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-16 text-right h-8 px-2"
                                            value={displayValue}
                                            placeholder="0"
                                            onFocus={() =>
                                              setActiveInput({
                                                id,
                                                value: (
                                                  customRatios[id] || 0
                                                ).toString(),
                                              })
                                            }
                                            onBlur={() => {
                                              if (
                                                activeInput &&
                                                customDistMode === "percent"
                                              ) {
                                                const num =
                                                  activeInput.value === ""
                                                    ? 0
                                                    : parseInt(
                                                        activeInput.value
                                                      );
                                                adjustDistribution(
                                                  id,
                                                  num,
                                                  "top"
                                                );
                                              }
                                              setActiveInput(null);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                e.currentTarget.blur();
                                              }
                                            }}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (
                                                val === "" ||
                                                /^\d*$/.test(val)
                                              ) {
                                                setActiveInput({
                                                  id,
                                                  value: val,
                                                });
                                                // Immediate update for count mode
                                                if (
                                                  customDistMode === "count"
                                                ) {
                                                  const num =
                                                    val === ""
                                                      ? 0
                                                      : Number(val);
                                                  setCustomRatios((prev) => ({
                                                    ...prev,
                                                    [id]: num,
                                                  }));
                                                }
                                              }
                                            }}
                                          />
                                          <span className="text-xs w-4 text-muted-foreground">
                                            {customDistMode === "percent"
                                              ? "%"
                                              : "#"}
                                          </span>
                                        </div>
                                      </div>

                                      {customDistMode === "percent" && (
                                        <input
                                          type="range"
                                          min="0"
                                          max="100"
                                          step="1"
                                          value={customRatios[id] || 0}
                                          onChange={(e) =>
                                            adjustDistribution(
                                              id,
                                              Number(e.target.value),
                                              "top"
                                            )
                                          }
                                          className="w-full accent-blue-500 h-3 bg-muted rounded-full appearance-none cursor-pointer hover:bg-muted/80 transition-all"
                                        />
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Tags Section */}
                                {selectedTags.length > 0 && (
                                  <div className="pt-4 border-t border-dashed">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2 text-sm font-bold text-primary">
                                        <span>Tags (Combined)</span>
                                        <div className="flex items-center gap-1">
                                          {customDistMode === "percent" && (
                                            <>
                                              <Input
                                                type="text"
                                                inputMode="numeric"
                                                className="w-16 text-right h-8 px-2 font-bold"
                                                value={
                                                  activeInput?.id ===
                                                  "_TAGS_TOTAL_"
                                                    ? activeInput.value
                                                    : customRatios[
                                                        "_TAGS_TOTAL_"
                                                      ] !== undefined
                                                    ? customRatios[
                                                        "_TAGS_TOTAL_"
                                                      ]
                                                    : ""
                                                }
                                                placeholder="0"
                                                onFocus={() =>
                                                  setActiveInput({
                                                    id: "_TAGS_TOTAL_",
                                                    value: (
                                                      customRatios[
                                                        "_TAGS_TOTAL_"
                                                      ] || 0
                                                    ).toString(),
                                                  })
                                                }
                                                onBlur={() => {
                                                  if (
                                                    activeInput &&
                                                    customDistMode === "percent"
                                                  ) {
                                                    const num =
                                                      activeInput.value === ""
                                                        ? 0
                                                        : parseInt(
                                                            activeInput.value
                                                          );
                                                    adjustDistribution(
                                                      "_TAGS_TOTAL_",
                                                      num,
                                                      "top"
                                                    );
                                                  }
                                                  setActiveInput(null);
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    e.currentTarget.blur();
                                                  }
                                                }}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (
                                                    val === "" ||
                                                    /^\d*$/.test(val)
                                                  ) {
                                                    setActiveInput({
                                                      id: "_TAGS_TOTAL_",
                                                      value: val,
                                                    });
                                                  }
                                                }}
                                              />
                                              <span className="text-xs w-4">
                                                %
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {customDistMode === "percent" && (
                                        <input
                                          type="range"
                                          min="0"
                                          max="100"
                                          step="1"
                                          value={
                                            customRatios["_TAGS_TOTAL_"] || 0
                                          }
                                          onChange={(e) =>
                                            adjustDistribution(
                                              "_TAGS_TOTAL_",
                                              Number(e.target.value),
                                              "top"
                                            )
                                          }
                                          className="w-full accent-green-500 h-3 bg-muted rounded-full appearance-none cursor-pointer"
                                        />
                                      )}

                                      {/* Individual Tags Sub-sliders */}
                                      <div className="pl-4 pt-2 space-y-4 border-l-2 border-muted ml-1">
                                        {selectedTags.map((id) => {
                                          const tag = tags.find(
                                            (t) => t.id === id
                                          );
                                          if (!tag) return null;
                                          return (
                                            <div key={id} className="space-y-1">
                                              <div className="flex items-center justify-between gap-2 text-xs">
                                                <span className="text-muted-foreground">
                                                  {tag.name}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                  <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    className="w-14 text-right h-7 px-1 text-xs"
                                                    value={
                                                      activeInput?.id === id
                                                        ? activeInput.value
                                                        : customRatios[id] !==
                                                          undefined
                                                        ? customRatios[id]
                                                        : ""
                                                    }
                                                    placeholder="0"
                                                    onFocus={() =>
                                                      setActiveInput({
                                                        id,
                                                        value: (
                                                          customRatios[id] || 0
                                                        ).toString(),
                                                      })
                                                    }
                                                    onBlur={() => {
                                                      if (
                                                        activeInput &&
                                                        customDistMode ===
                                                          "percent"
                                                      ) {
                                                        const num =
                                                          activeInput.value ===
                                                          ""
                                                            ? 0
                                                            : parseInt(
                                                                activeInput.value
                                                              );
                                                        adjustDistribution(
                                                          id,
                                                          num,
                                                          "tags"
                                                        );
                                                      }
                                                      setActiveInput(null);
                                                    }}
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter") {
                                                        e.currentTarget.blur();
                                                      }
                                                    }}
                                                    onChange={(e) => {
                                                      const val =
                                                        e.target.value;
                                                      if (
                                                        val === "" ||
                                                        /^\d*$/.test(val)
                                                      ) {
                                                        setActiveInput({
                                                          id,
                                                          value: val,
                                                        });
                                                        if (
                                                          customDistMode ===
                                                          "count"
                                                        ) {
                                                          const num =
                                                            val === ""
                                                              ? 0
                                                              : Number(val);
                                                          setCustomRatios(
                                                            (prev) => ({
                                                              ...prev,
                                                              [id]: num,
                                                            })
                                                          );
                                                        }
                                                      }
                                                    }}
                                                  />
                                                  <span className="text-[10px] w-3 text-muted-foreground">
                                                    {customDistMode ===
                                                    "percent"
                                                      ? "%"
                                                      : "#"}
                                                  </span>
                                                </div>
                                              </div>
                                              {customDistMode === "percent" && (
                                                <input
                                                  type="range"
                                                  min="0"
                                                  max="100"
                                                  step="1"
                                                  value={customRatios[id] || 0}
                                                  onChange={(e) =>
                                                    adjustDistribution(
                                                      id,
                                                      Number(e.target.value),
                                                      "tags"
                                                    )
                                                  }
                                                  className="w-full accent-orange-400 h-2 bg-muted rounded-full appearance-none cursor-pointer"
                                                />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        <div className="pt-2 flex items-center space-x-2">
                          <Switch
                            id="simul-jokers"
                            checked={room.settings?.simultaneousJokers || false}
                            onCheckedChange={(checked) =>
                              socket?.emit("update_settings", {
                                code,
                                settings: {
                                  simultaneousJokers: checked,
                                },
                              })
                            }
                          />
                          <Label
                            htmlFor="simul-jokers"
                            className="font-semibold cursor-pointer"
                          >
                            {t("config.simultaneousJokers")}
                          </Label>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleStartGame}
                      disabled={
                        selectedCollections.length === 0 ||
                        (parseInt(totalQuestions) || 0) < 1 ||
                        (ratioStrategy === "custom" &&
                          customDistMode === "count" &&
                          questionsLeft !== 0)
                      }
                      className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg"
                    >
                      {t("startGame")}
                    </Button>

                    <div className="pt-4 mt-4 border-t">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            Delete Lobby
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("deleteLobbyTitle", {
                                defaultValue: "Delete Lobby?",
                              })}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("deleteLobbyConfirm", {
                                defaultValue:
                                  "Are you sure you want to delete this lobby? All players will be disconnected.",
                              })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("cancel", { defaultValue: "Cancel" })}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => socket?.emit("delete_room", code)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("delete", { defaultValue: "Delete" })}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(room.phase === "question" || room.phase === "reveal") &&
            room.currentQ && (
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div className="bg-muted px-4 py-2 rounded-t-lg font-bold text-sm uppercase tracking-widest text-muted-foreground">
                    {t("questionNum", { n: room.questionIndex + 1 })}
                  </div>
                  <div className="bg-yellow-500/20 text-yellow-500 px-4 py-2 rounded-t-lg font-black text-sm uppercase tracking-widest">
                    {t("points", { n: Math.floor(room.questionIndex / 2) + 1 })}
                  </div>
                </div>

                <Card className="bg-card border-purple-500/30 border-2 p-8 text-center shadow-[0_0_30px_rgba(168,85,247,0.1)] relative overflow-hidden">
                  {spyActive && (
                    <div className="absolute top-2 right-2 text-xs bg-blue-500 text-white px-2 py-1 rounded animate-pulse">
                      {t("spyActive")}
                    </div>
                  )}
                  {enemySpyActive && (
                    <div className="absolute top-2 left-2 z-50 text-xs bg-red-600 text-white px-2 py-1 rounded animate-pulse font-bold uppercase tracking-wider shadow-lg border border-red-400 pointer-events-none">
                      ⚠️ SPY DETECTED ⚠️
                    </div>
                  )}
                  <h2 className="text-3xl font-black leading-tight">
                    {room.currentQ.text}
                  </h2>
                </Card>

                {/* Timer Bar */}
                <div className="w-full">
                  <Progress
                    value={progress}
                    className="h-4"
                    indicatorClassName={
                      progress < 20
                        ? "bg-red-500"
                        : progress < 50
                        ? "bg-yellow-500"
                        : "bg-blue-500"
                    }
                  />
                </div>

                {/* Joker Bar */}
                {room.phase === "question" && (
                  <div className="flex flex-col items-center gap-2 mb-4">
                    {!room.settings?.simultaneousJokers &&
                      room.jokerUsedThisQ &&
                      jokerUserToken !== playerToken && (
                        <div className="text-sm font-bold text-red-500 bg-red-500/10 px-3 py-1 rounded border border-red-500/20 animate-pulse">
                          {jokerType === "5050"
                            ? "50/50"
                            : jokerType === "spy"
                            ? "SPY"
                            : jokerType === "risk"
                            ? "RISK"
                            : "JOKER"}{" "}
                          used by {jokerUser || "another player"}
                        </div>
                      )}
                    <div className="flex gap-4 justify-center">
                      {room.players[playerToken]?.usedSpyThisQ ? (
                        <div className="px-3 py-2 rounded bg-green-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg animate-in fade-in zoom-in duration-300">
                          🕵️ Spy Active
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !room.players[playerToken]?.jokerSpy ||
                            disabledOptions.length > 0 ||
                            (!room.settings?.simultaneousJokers &&
                              room.jokerUsedThisQ)
                          }
                          onClick={() =>
                            socket?.emit("use_joker", { code, type: "spy" })
                          }
                          className="border-blue-500/50 hover:bg-blue-500/10"
                        >
                          🕵️ {t("joker.spy")}
                        </Button>
                      )}

                      {room.players[playerToken]?.used5050ThisQ ? (
                        <div className="px-3 py-2 rounded bg-green-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg animate-in fade-in zoom-in duration-300">
                          ⚖️ 50/50 Active
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !room.players[playerToken]?.joker5050 ||
                            disabledOptions.length > 0 ||
                            (!room.settings?.simultaneousJokers &&
                              room.jokerUsedThisQ)
                          }
                          onClick={() =>
                            socket?.emit("use_joker", { code, type: "5050" })
                          }
                          className="border-purple-500/50 hover:bg-purple-500/10"
                        >
                          ⚖️ {t("joker.5050")}
                        </Button>
                      )}

                      {room.players[playerToken]?.usedRiskThisQ ? (
                        <div className="px-3 py-2 rounded bg-green-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg animate-in fade-in zoom-in duration-300">
                          🔥 Risk Active
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !room.players[playerToken]?.jokerRisk ||
                            disabledOptions.length > 0 ||
                            (!room.settings?.simultaneousJokers &&
                              room.jokerUsedThisQ)
                          }
                          onClick={() =>
                            socket?.emit("use_joker", { code, type: "risk" })
                          }
                          className={clsx(
                            "border-red-500/50 hover:bg-red-500/10",
                            room.players[playerToken]?.usedRiskThisQ &&
                              "bg-red-500/20 ring-1 ring-red-500"
                          )}
                        >
                          🔥 {t("joker.risk")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {room.currentQ.choices.map((choice, idx) => {
                    const isDisabled = disabledOptions.includes(idx);
                    const myPlayer = room.players[playerToken];
                    const currentSelection =
                      selectedAnswer ?? myPlayer?.selectedChoice ?? null;
                    const isSelected = currentSelection === idx;
                    const hasSelected = currentSelection !== null;

                    return (
                      <Button
                        key={idx}
                        className={clsx(
                          "h-24 text-xl font-bold border-2 border-border hover:scale-[1.02] transition-all",
                          "bg-card text-card-foreground hover:bg-accent",
                          // Highlight logic for Reveal phase
                          room.phase === "reveal" &&
                            idx === room.revealData?.correctIndex &&
                            "bg-green-600 border-green-400 hover:bg-green-600 text-white",
                          room.phase === "reveal" &&
                            idx !== room.revealData?.correctIndex &&
                            "opacity-50",

                          // Highlight logic for Question phase
                          room.phase === "question" &&
                            hasSelected &&
                            !isSelected &&
                            "opacity-50",
                          room.phase === "question" &&
                            isSelected &&
                            "border-primary bg-primary/10",

                          isDisabled &&
                            "opacity-20 cursor-not-allowed decoration-slice line-through"
                        )}
                        onClick={() => {
                          setSelectedAnswer(idx);
                          socket?.emit("submit_answer", { code, choice: idx });
                        }}
                        disabled={
                          room.phase !== "question" || isDisabled || room.paused
                        }
                      >
                        {choice}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
        </div>

        {/* Sidebar (Players / Leaderboard) */}
        <div className="col-span-4 space-y-4">
          <Card className="bg-card border-border h-full">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider">
                {t("players")} ({Object.keys(room.players).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px] px-6 py-4">
                <div className="space-y-3">
                  {Object.values(room.players)
                    .sort((a, b) => b.score - a.score)
                    .map((player) => (
                      <div
                        key={player.token}
                        className={clsx(
                          "flex flex-col p-3 rounded-lg border gap-2 transition-all hover:bg-accent/50",
                          player.token === playerToken
                            ? "bg-primary/5 border-primary/20"
                            : "bg-card border-border"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <UserAvatar
                              src={player.avatar}
                              name={player.name}
                              className="w-9 h-9 ring-2 ring-background shadow-sm"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-sm truncate">
                                {player.name}
                              </span>
                              {player.token === room.hostToken && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1 h-4 w-fit"
                                >
                                  HOST
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="font-mono text-base px-2 py-0 border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
                          >
                            {player.score}
                          </Badge>
                        </div>

                        {/* Spy View: Show selected answer if I am the spy */}
                        {spyActive &&
                          player.token !== playerToken &&
                          player.selectedChoice !== null && (
                            <div className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1.5 rounded border border-blue-500/20 font-mono text-center shadow-sm">
                              Selected:{" "}
                              <span className="font-bold">
                                {room.currentQ?.choices[player.selectedChoice]}
                              </span>
                            </div>
                          )}

                        {/* Jokers Display */}
                        <div className="flex gap-2 justify-end border-t border-border/50 pt-2 mt-1">
                          <div
                            className={clsx(
                              "text-xs flex items-center gap-1 px-1.5 py-0.5 rounded transition-all",
                              player.joker5050
                                ? "opacity-100 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                : "opacity-30 grayscale",
                              player.used5050ThisQ &&
                                player.token !== playerToken &&
                                "ring-2 ring-purple-500 ring-offset-1"
                            )}
                            title="50/50 Joker"
                          >
                            <span>⚖️</span>
                          </div>
                          <div
                            className={clsx(
                              "text-xs flex items-center gap-1 px-1.5 py-0.5 rounded transition-all",
                              player.jokerSpy
                                ? "opacity-100 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                : "opacity-30 grayscale",
                              player.usedSpyThisQ &&
                                player.token !== playerToken &&
                                "ring-2 ring-blue-500 ring-offset-1 animate-pulse"
                            )}
                            title="Spy Joker"
                          >
                            <span>🕵️</span>
                          </div>
                          <div
                            className={clsx(
                              "text-xs flex items-center gap-1 px-1.5 py-0.5 rounded transition-all",
                              player.jokerRisk
                                ? "opacity-100 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : "opacity-30 grayscale",
                              player.usedRiskThisQ &&
                                player.token !== playerToken &&
                                "ring-2 ring-red-500 ring-offset-1 animate-pulse"
                            )}
                            title="Risk Joker"
                          >
                            <span>🔥</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
