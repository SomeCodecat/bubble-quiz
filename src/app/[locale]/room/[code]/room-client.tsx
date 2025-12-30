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

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ code: string }>;
}

interface RoomClientProps {
  code: string;
  collections: {
    id: string;
    name: string;
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

  const timerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!room || !timerRef.current) return;

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
        if (timerRef.current) {
          timerRef.current.style.width = `${percent}%`;
        }

        if (!isPaused && remaining > 0) {
          rafRef.current = requestAnimationFrame(updateTimer);
        }
      } else {
        if (timerRef.current) {
          timerRef.current.style.width = "100%";
        }
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
  const [totalQuestions, setTotalQuestions] = useState(30);
  const [ratioStrategy, setRatioStrategy] = useState<
    "by_collection" | "consistent" | "custom"
  >("by_collection");
  const [customRatios, setCustomRatios] = useState<Record<string, number>>({});

  const handleStartGame = () => {
    if (!socket) return;
    // Validate
    if (selectedCollections.length === 0 && selectedTags.length === 0) {
      alert(t("selectError"));
      return;
    }

    const config = {
      collectionIds: selectedCollections,
      tagIds: selectedTags,
      totalQuestions,
      ratioStrategy,
      customRatios,
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

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col items-center">
      {/* Header / StatusBar */}
      <div className="w-full max-w-6xl flex justify-between items-center bg-card p-4 rounded-xl border border-border mb-6">
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

      <div className="w-full max-w-6xl grid grid-cols-12 gap-6">
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
                      <div className="space-y-4 border p-4 rounded-lg">
                        <h3 className="font-bold border-b pb-2">
                          {t("config.selectCollections")}
                        </h3>
                        <div className="max-h-[200px] overflow-y-auto space-y-2">
                          {collections.map((col) => (
                            <label
                              key={col.id}
                              className="flex items-center justify-between gap-2 p-2 hover:bg-muted rounded cursor-pointer border"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedCollections.includes(col.id)}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setSelectedCollections([
                                        ...selectedCollections,
                                        col.id,
                                      ]);
                                    else
                                      setSelectedCollections(
                                        selectedCollections.filter(
                                          (id) => id !== col.id
                                        )
                                      );
                                  }}
                                  className="w-4 h-4"
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">
                                    {col.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    by{" "}
                                    {col.creator.name ||
                                      col.creator.username ||
                                      "Unknown"}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs badge bg-muted-foreground/20 px-2 py-0.5 rounded">
                                {col._count.questions}
                              </span>
                            </label>
                          ))}
                          {collections.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              {t("config.noCollections")}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 border p-4 rounded-lg">
                        <h3 className="font-bold border-b pb-2">
                          {t("config.selectTags")}
                        </h3>
                        <div className="max-h-[200px] overflow-y-auto space-y-2">
                          {tags.map((tag) => (
                            <label
                              key={tag.id}
                              className="flex items-center justify-between gap-2 p-2 hover:bg-muted rounded cursor-pointer border"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTags.includes(tag.id)}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setSelectedTags([
                                        ...selectedTags,
                                        tag.id,
                                      ]);
                                    else
                                      setSelectedTags(
                                        selectedTags.filter(
                                          (id) => id !== tag.id
                                        )
                                      );
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm font-medium">
                                  {tag.name}
                                </span>
                              </div>
                              <span className="text-xs badge bg-muted-foreground/20 px-2 py-0.5 rounded">
                                {tag._count.questions}
                              </span>
                            </label>
                          ))}
                          {tags.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              {t("config.noTags")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4 border p-4 rounded-lg">
                        <h3 className="font-bold border-b pb-2">
                          {t("config.gameSettings")}
                        </h3>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            {t("config.totalQuestions")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={totalQuestions}
                              onChange={(e) =>
                                setTotalQuestions(Number(e.target.value))
                              }
                              max={maxAvailable}
                              min={1}
                              className="border rounded p-1 w-20 text-center bg-background"
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
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name="ratio"
                                checked={ratioStrategy === "by_collection"}
                                onChange={() =>
                                  setRatioStrategy("by_collection")
                                }
                              />
                              {t("config.distCollection")}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name="ratio"
                                checked={ratioStrategy === "consistent"}
                                onChange={() => setRatioStrategy("consistent")}
                              />
                              {t("config.distConsistent")}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name="ratio"
                                checked={ratioStrategy === "custom"}
                                onChange={() => setRatioStrategy("custom")}
                              />
                              {t("config.distCustom")}
                            </label>
                          </div>
                        </div>

                        {ratioStrategy === "custom" && (
                          <div className="space-y-1 mt-2 max-h-[100px] overflow-y-auto">
                            {selectedCollections.map((id) => {
                              const col = collections.find((c) => c.id === id);
                              if (!col) return null;
                              return (
                                <div
                                  key={id}
                                  className="flex justify-between items-center text-xs"
                                >
                                  <span className="truncate w-32">
                                    {col.name}
                                  </span>
                                  <input
                                    type="number"
                                    className="w-12 border rounded px-1 bg-background"
                                    placeholder="0"
                                    value={customRatios[id] || 0}
                                    onChange={(e) =>
                                      setCustomRatios({
                                        ...customRatios,
                                        [id]: Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="pt-2">
                          <label className="text-sm font-semibold cursor-pointer select-none flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={
                                room.settings?.simultaneousJokers || false
                              }
                              onChange={(e) =>
                                socket?.emit("update_settings", {
                                  code,
                                  settings: {
                                    simultaneousJokers: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 accent-primary"
                            />
                            {t("config.simultaneousJokers")}
                          </label>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleStartGame}
                      disabled={
                        selectedCollections.length === 0 || totalQuestions < 1
                      }
                      className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg"
                    >
                      {t("startGame")}
                    </Button>

                    <div className="pt-4 mt-4 border-t">
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this lobby? All players will be disconnected."
                            )
                          ) {
                            socket?.emit("delete_room", code);
                          }
                        }}
                      >
                        Delete Lobby
                      </Button>
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
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    ref={timerRef}
                    className="h-full bg-blue-500"
                    style={{ width: "100%" }}
                  ></div>
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
            <CardContent className="space-y-2">
              {Object.values(room.players)
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <div
                    key={player.token}
                    className="flex flex-col bg-muted p-3 rounded border border-border gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={player.avatar}
                          name={player.name}
                          className="w-8 h-8 ring-2 ring-background"
                        />
                        <span className="font-semibold text-sm truncate max-w-[100px]">
                          {player.name}
                        </span>
                      </div>
                      <div className="font-mono text-yellow-500 font-bold">
                        {player.score}
                      </div>
                    </div>

                    {/* Spy View: Show selected answer if I am the spy */}
                    {spyActive &&
                      player.token !== playerToken &&
                      player.selectedChoice !== null && (
                        <div className="text-xs bg-blue-500/20 text-blue-500 px-2 py-1 rounded border border-blue-500/50 font-mono text-center">
                          Selected:{" "}
                          <span className="font-bold">
                            {room.currentQ?.choices[player.selectedChoice]}
                          </span>
                        </div>
                      )}

                    {/* Jokers Display */}
                    <div className="flex gap-2 justify-end border-t border-border/50 pt-2">
                      <div
                        className={clsx(
                          "text-xs flex items-center gap-1 p-1 rounded",
                          player.joker5050
                            ? "opacity-100"
                            : "opacity-20 grayscale",
                          player.used5050ThisQ &&
                            player.token !== playerToken &&
                            "border border-purple-500 bg-purple-500/10"
                        )}
                        title="50/50 Joker"
                      >
                        <span>⚖️</span>
                      </div>
                      <div
                        className={clsx(
                          "text-xs flex items-center gap-1 p-1 rounded",
                          player.jokerSpy
                            ? "opacity-100"
                            : "opacity-20 grayscale",
                          player.usedSpyThisQ &&
                            player.token !== playerToken &&
                            "border border-blue-500 bg-blue-500/10 animate-pulse"
                        )}
                        title="Spy Joker"
                      >
                        <span>🕵️</span>
                      </div>
                      <div
                        className={clsx(
                          "text-xs flex items-center gap-1 p-1 rounded",
                          player.jokerRisk
                            ? "opacity-100"
                            : "opacity-20 grayscale",
                          player.usedRiskThisQ &&
                            player.token !== playerToken &&
                            "border border-red-500 bg-red-500/10 animate-pulse"
                        )}
                        title="Risk Joker"
                      >
                        <span>🔥</span>
                      </div>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
