"use client";

import { useState, useEffect } from "react";
import { toggleLock } from "./actions";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Unlock, User as UserIcon, Pencil, Trash2 } from "lucide-react";
import { QuestionFilterSidebar } from "./question-filter-sidebar";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  QuestionDeleteButton,
  QuestionRestoreButton,
} from "./question-actions-client";
import { QuestionLockToggle } from "./question-lock-toggle";

interface Question {
  id: string;
  shortCode?: string;
  text: string;
  options: string[]; // Parsed JSON
  correctIndex: number;
  creatorId: string | null;
  isLocked: boolean;
  isPermanentlyPublic?: boolean;
  creator: {
    username: string | null;
    name: string | null;
  } | null;
  owner?: {
    id: string;
    username: string | null;
    name: string | null;
  } | null;
  deletedBy?: {
    id: string;
    username: string | null;
    name: string | null;
  } | null;
  deletedAt?: Date | null;
  tags?: { tag: { name: string; icon: string | null } }[];
  collections?: {
    collection: { id: string; name: string; isLocked: boolean };
  }[];
}

// ... imports

interface Props {
  questions: Question[];
  allTags?: { id: string; name: string }[];
  currentUserId: string;
  isAdmin: boolean;
  hideTabs?: boolean;
  renderActions?: (question: Question, isOwner: boolean) => React.ReactNode;
}

export function QuestionList({
  questions,
  allTags = [],
  currentUserId,
  isAdmin,
  hideTabs,
  renderActions,
}: Props) {
  const t = useTranslations("Questions");
  const [filter, setFilter] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tab, setTab] = useState("all");
  const [view, setView] = useState<"grid" | "list" | "square">("grid");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load view from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("questionListView") as
      | "grid"
      | "list"
      | "square";
    if (saved && ["grid", "list", "square"].includes(saved)) {
      setView(saved);
    }
    setIsLoaded(true);
  }, []);

  // Save view to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("questionListView", view);
    }
  }, [view, isLoaded]);

  const filtered = questions.filter((q) => {
    const matchText = q.text.toLowerCase().includes(filter.toLowerCase());
    const matchTab = tab === "all" ? true : q.creatorId === currentUserId;

    let matchTags = true;
    if (selectedTags.length > 0) {
      matchTags = selectedTags.every((tId) =>
        q.tags?.some((qt) => qt.tag.name === tId)
      ); // Check logic: ID vs Name?
      // We fetched `allTags` which has ID and Name.
      // `q.tags` has `tag` which has name.
      // Let's use ID for selection but if simple strings fetched?
      // Let's check schema. Relation is QuestionTag.
      // q.tags structure: { tag: { name: string, icon... } }[]
      // Let's filter by NAME for simplicity if ID not available in q.tags?
      // Wait, `include: { tag: true }` fetching ALL tag fields.
      // So q.tags[i].tag.id exists.
    }
    // Re-implement correctly with IDs
    if (selectedTags.length > 0) {
      matchTags = selectedTags.every((tName) =>
        q.tags?.some((qt) => qt.tag.name === tName)
      );
      // Using Name for visual simplicity in mockup, but strictly should use ID.
      // Let's use Name key for now as `allTags` passed from page might be simple.
    }

    return matchText && matchTab && matchTags;
  });

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar */}
      {!hideTabs && (
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-4">
            <QuestionFilterSidebar
              filter={filter}
              setFilter={setFilter}
              view={view}
              setView={setView}
              currentUserId={currentUserId}
              allTags={allTags}
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
            />
            <div className="mt-6">
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="all">{t("all")}</TabsTrigger>
                  <TabsTrigger value="my">{t("my")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 space-y-4">
        {/* If tabs hidden (Collection View), just show content */}

        <div
          className={`grid gap-4 ${
            view === "list"
              ? "grid-cols-1"
              : view === "square"
              ? "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]"
              : "md:grid-cols-2 lg:grid-cols-2"
          } ${
            !isLoaded
              ? "opacity-0"
              : "opacity-100 transition-opacity duration-300"
          }`}
        >
          {filtered.map((q) => {
            const isOwner = q.creatorId === currentUserId || isAdmin;
            const options = q.options;

            if (view === "list") {
              return (
                <Card
                  key={q.id}
                  className={`bg-card border-border transition-all flex flex-row items-center p-3 gap-4 ${
                    q.isLocked
                      ? "border-amber-500/50 bg-amber-950/10"
                      : q.isPermanentlyPublic
                      ? "border-blue-500/50 bg-blue-950/10"
                      : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1">
                        <UserAvatar
                          user={q.owner || q.creator}
                          className="h-4 w-4"
                        />
                        <span className="text-muted-foreground mx-1">
                          {q.owner ? t("ownedBy") : t("createdBy")}
                        </span>
                        {(q.owner?.id || q.creatorId) === currentUserId ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                            {t("me")}
                          </span>
                        ) : (
                          <span>
                            {(q.owner || q.creator)?.username ||
                              (q.owner || q.creator)?.name ||
                              t("unknown")}
                          </span>
                        )}
                      </div>
                      {q.deletedAt && (
                        <div className="flex items-center gap-1 text-destructive">
                          <Trash2 className="h-3 w-3" />
                          <span>
                            {t("deletedBy", {
                              name:
                                q.deletedBy?.username ||
                                q.deletedBy?.name ||
                                t("unknown"),
                            })}
                          </span>
                        </div>
                      )}
                      {q.tags?.map((t, i) => (
                        <span
                          key={i}
                          className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-1"
                        >
                          {t.tag.name}
                        </span>
                      ))}

                      <div className="flex gap-1 ml-2 items-center">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`rounded-full border flex items-center justify-center text-[10px] px-2 h-5 ${
                              i === q.correctIndex
                                ? "bg-transparent border-emerald-500 text-emerald-500 font-bold"
                                : "bg-transparent border-muted-foreground/30 w-5"
                            }`}
                          >
                            {i === q.correctIndex && options[i]}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{q.text}</span>
                      {q.isLocked && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-500 font-mono uppercase tracking-widest shrink-0">
                          <Lock className="h-3 w-3" />
                          <span>
                            {(() => {
                              const lockingCollection = q.collections?.find(
                                (c) => c.collection.isLocked
                              )?.collection;
                              return lockingCollection
                                ? t("lockedByCollection", {
                                    name: lockingCollection.name,
                                  })
                                : t("private");
                            })()}
                          </span>
                        </div>
                      )}
                      {q.isPermanentlyPublic && (
                        <span className="text-[10px] text-blue-500 font-mono uppercase tracking-widest shrink-0">
                          Public
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderActions && renderActions(q, isOwner)}
                    {(isOwner || !q.isLocked) && (
                      <>
                        <Link href={`/questions/${q.id}/edit`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        {isOwner && (
                          <>
                            {!q.deletedAt && (
                              <QuestionLockToggle
                                questionId={q.id}
                                isLocked={q.isLocked}
                                isPermanentlyPublic={q.isPermanentlyPublic}
                                lockedCollections={
                                  q.collections
                                    ?.map((c) => c.collection)
                                    .filter((c) => c.isLocked) || []
                                }
                                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                isAdmin={isAdmin}
                              />
                            )}
                            {q.deletedAt ? (
                              <QuestionRestoreButton questionId={q.id} />
                            ) : (
                              <QuestionDeleteButton questionId={q.id} />
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            }

            if (view === "square") {
              return (
                <Card
                  key={q.id}
                  className={`bg-card border-border transition-all flex flex-col relative group overflow-hidden p-0 gap-0 ${
                    q.isLocked
                      ? "border-amber-500/50 bg-amber-950/10"
                      : q.isPermanentlyPublic
                      ? "border-blue-500/50 bg-blue-950/10"
                      : ""
                  } aspect-square`}
                >
                  {/* Header / Lock Area */}
                  <div className="absolute top-2 left-2 z-10 pointer-events-none max-w-[calc(100%-2rem)]">
                    <div className="bg-background/90 rounded-full shadow-sm backdrop-blur-md px-2 py-1 flex items-center gap-1.5 border border-border/50">
                      {q.isLocked && (
                        <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                      <div className="flex items-center gap-1 text-[10px] leading-none truncate">
                        <span className="text-muted-foreground shrink-0">
                          {q.owner ? t("ownedBy") : t("createdBy")}
                        </span>
                        {(q.owner?.id || q.creatorId) === currentUserId ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {t("me")}
                          </span>
                        ) : (
                          <span className="truncate max-w-[80px]">
                            {(q.owner || q.creator)?.username ||
                              (q.owner || q.creator)?.name ||
                              t("unknown")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {q.isPermanentlyPublic && (
                    <div className="absolute top-2 right-2 z-10 pointer-events-none group-hover:opacity-0 transition-opacity">
                      <div className="bg-background/50 rounded-full shadow-sm backdrop-blur-sm h-8 w-8 flex items-center justify-center">
                        <Unlock className="h-4 w-4 text-blue-500" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {renderActions && renderActions(q, isOwner)}
                    {(isOwner || !q.isLocked) && (
                      <Link href={`/questions/${q.id}/edit`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-background/50 hover:bg-background shadow-sm backdrop-blur-sm"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </Link>
                    )}
                    {isOwner ? (
                      <>
                        {q.deletedAt ? (
                          <div className="bg-background/50 rounded-full shadow-sm backdrop-blur-sm h-8 w-8 flex items-center justify-center hover:bg-background transition-colors">
                            <QuestionRestoreButton questionId={q.id} />
                          </div>
                        ) : (
                          <div className="bg-background/50 rounded-full shadow-sm backdrop-blur-sm h-8 w-8 flex items-center justify-center hover:bg-background transition-colors">
                            <QuestionDeleteButton questionId={q.id} />
                          </div>
                        )}
                        {!q.deletedAt && (
                          <QuestionLockToggle
                            questionId={q.id}
                            isLocked={q.isLocked}
                            isPermanentlyPublic={q.isPermanentlyPublic}
                            lockedCollections={
                              q.collections
                                ?.map((c) => c.collection)
                                .filter((c) => c.isLocked) || []
                            }
                            className="h-8 w-8 rounded-full bg-background/50 hover:bg-background shadow-sm backdrop-blur-sm"
                            isAdmin={isAdmin}
                          />
                        )}
                      </>
                    ) : (
                      q.isLocked && (
                        <div className="p-2 rounded-full bg-background/50 backdrop-blur-sm">
                          <Lock className="h-4 w-4 text-amber-500 opacity-75" />
                        </div>
                      )
                    )}
                  </div>

                  <div className="flex flex-col h-full">
                    {/* Question Text */}
                    <div className="shrink-0 p-4 pb-2 pt-12">
                      <span className="font-bold text-base leading-snug line-clamp-3 pr-8 block text-left">
                        {q.text}
                      </span>
                    </div>

                    {/* Options Grid (Fills remaining space) */}
                    <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0 p-4 pt-0">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`rounded-lg border flex items-center justify-center p-2 text-center transition-colors relative overflow-hidden ${
                            i === q.correctIndex
                              ? "bg-emerald-500/10 border-emerald-500/50"
                              : "bg-muted/30 border-transparent"
                          }`}
                        >
                          {i === q.correctIndex && (
                            <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
                          )}
                          <span
                            className={`text-xs font-medium leading-tight line-clamp-3 break-words w-full ${
                              i === q.correctIndex
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {options[i]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            }

            return (
              <Card
                key={q.id}
                className={`bg-card border-border transition-all ${
                  q.isLocked ? "border-amber-500/50 bg-amber-950/10" : ""
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <UserAvatar
                        user={q.owner || q.creator}
                        className="h-4 w-4"
                      />
                      <span className="text-muted-foreground mx-1">
                        {q.owner ? t("ownedBy") : t("createdBy")}
                      </span>
                      {(q.owner?.id || q.creatorId) === currentUserId ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                          {t("me")}
                        </span>
                      ) : (
                        <span>
                          {(q.owner || q.creator)?.username ||
                            (q.owner || q.creator)?.name ||
                            "Unknown"}
                        </span>
                      )}
                      {q.deletedAt && (
                        <div className="flex items-center gap-1 text-destructive ml-2">
                          <Trash2 className="h-3 w-3" />
                          <span>
                            {t("deletedBy", {
                              name:
                                q.deletedBy?.username ||
                                q.deletedBy?.name ||
                                t("unknown"),
                            })}
                          </span>
                        </div>
                      )}
                      {q.collections?.map((c) => (
                        <span
                          key={c.collection.id}
                          className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full"
                        >
                          {c.collection.name}
                        </span>
                      ))}
                    </div>
                    <CardTitle className="text-base font-semibold leading-tight">
                      {q.text}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* ShortCode Badge */}
                    <div className="hidden md:flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50 border border-border/50 px-1 rounded">
                      #{q.shortCode}
                    </div>

                    {q.isLocked && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-500 font-mono uppercase tracking-widest">
                        <Lock className="h-3 w-3" />
                        <span>
                          {(() => {
                            const lockingCollection = q.collections?.find(
                              (c) => c.collection.isLocked
                            )?.collection;
                            if (lockingCollection) {
                              return t("lockedByCollection", {
                                name: lockingCollection.name,
                              });
                            }
                            // If locked but no locking collection, it's personally locked or admin locked
                            if (isAdmin && q.owner) {
                              return `${t("locked")} (${
                                q.owner.username || q.owner.name || "Unknown"
                              })`;
                            }
                            return t("private");
                          })()}
                        </span>
                      </div>
                    )}
                    {renderActions && renderActions(q, isOwner)}

                    {(isOwner || !q.isLocked) && (
                      <Link href={`/questions/${q.id}/edit`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}

                    {isOwner && (
                      <QuestionLockToggle
                        questionId={q.id}
                        isLocked={q.isLocked}
                        isPermanentlyPublic={q.isPermanentlyPublic}
                        lockedCollections={
                          q.collections
                            ?.map((c) => c.collection)
                            .filter((c) => c.isLocked) || []
                        }
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        isAdmin={isAdmin}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    {options.map((opt, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded border ${
                          i === q.correctIndex
                            ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted/50 border-transparent text-muted-foreground"
                        }`}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No questions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
