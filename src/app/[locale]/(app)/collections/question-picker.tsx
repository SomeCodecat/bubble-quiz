"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Layers,
  User,
  Globe,
  Plus,
  LayoutGrid,
  List,
} from "lucide-react";
import { getAvailableCollections, searchQuestions, addQuestionsToCollection } from "./actions";
import { useDebounce } from "use-debounce";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  targetCollectionId: string;
}

export function QuestionPicker({ targetCollectionId }: Props) {
  const t = useTranslations("Collections");
  const [open, setOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  ); // null = all
  const [searchQuery, setSearchQuery] = useState("");
  const [collections, setCollections] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);

  const [debouncedSearch] = useDebounce(searchQuery, 300);

  // Local selection state
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Load Collections on open
  useEffect(() => {
    if (open) {
      startTransition(async () => {
        const cols = await getAvailableCollections();
        setCollections(cols);
        // Initial load of all questions
        const qs = await searchQuestions("", null);
        setQuestions(qs);
        setSelectedQuestionIds(new Set()); // Reset on open
      });
    }
  }, [open]);

  // Search/Filter Effect
  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const qs = await searchQuestions(debouncedSearch, selectedCollection);
      setQuestions(qs);
    });
  }, [debouncedSearch, selectedCollection, open]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedQuestionIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedQuestionIds(next);
  };

  const handleBulkAdd = async () => {
    const ids = Array.from(selectedQuestionIds);
    if (ids.length === 0) return;

    setIsAdding(true);
    try {
      const res = await addQuestionsToCollection(targetCollectionId, ids);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("questionAdded", { count: res.count ?? 0 }));
        setOpen(false);
      }
    } catch (e) {
      toast.error(t("addError"));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("addQuestions")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[95vw] max-w-[95vw] w-[95vw] h-[90vh] flex flex-col gap-0 p-0 overflow-hidden text-foreground bg-background">
        <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <DialogTitle>{t("addQuestionsTitle")}</DialogTitle>
            <DialogDescription>{t("addQuestionsDesc")}</DialogDescription>
            <div className="relative mt-2 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
             {selectedQuestionIds.size > 0 && (
                <div className="text-sm font-medium text-muted-foreground hidden sm:block">
                  {selectedQuestionIds.size} selected
                </div>
             )}
             <Button 
                onClick={handleBulkAdd} 
                disabled={isAdding || selectedQuestionIds.size === 0}
                className="font-bold"
             >
                {isAdding ? t("saving") : t("addQuestionsCount", { count: selectedQuestionIds.size, defaultValue: `Add ${selectedQuestionIds.size} Questions` })}
             </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: Collections */}
          <div className="w-72 border-r bg-muted/10 flex flex-col shrink-0">
            <div className="p-2 border-b">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                {t("collectionsHeader")}
              </h3>
              <Button
                variant={selectedCollection === null ? "secondary" : "ghost"}
                className="w-full justify-start mb-1"
                onClick={() => setSelectedCollection(null)}
              >
                <Globe className="mr-2 h-4 w-4" />
                {t("allQuestions")}
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {collections.map((col) => (
                  <Button
                    key={col.id}
                    variant={
                      selectedCollection === col.id ? "secondary" : "ghost"
                    }
                    className="w-full justify-start h-auto py-3 items-start"
                    onClick={() => setSelectedCollection(col.id)}
                  >
                    <Layers className="mr-2 h-4 w-4 mt-1 shrink-0" />
                    <div className="text-left overflow-hidden">
                      <div className="font-medium truncate">{col.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {col.creator?.username || t("unknown")} •{" "}
                        {col._count.questions} qs
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main: Questions Grid */}
          <ScrollArea className="flex-1 bg-background">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium">
                  {selectedCollection
                    ? t("questionsIn", {
                        collection:
                          collections.find((c) => c.id === selectedCollection)
                            ?.name || "Collection",
                      })
                    : t("allAvailable")}
                </h3>
                {isPending && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    {t("loading")}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {questions.map((q) => {
                  const isSelected = selectedQuestionIds.has(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleSelection(q.id)}
                      className={cn(
                        "border rounded-lg p-3 flex flex-col gap-2 transition-all cursor-pointer group relative",
                        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/5"
                      )}
                    >
                      <div className="flex-1">
                        <div className="font-medium line-clamp-2 text-sm">
                          {q.text}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {q.creator?.username || q.creator?.name || t("unknown")}
                        </div>
                      </div>
                      <div className="flex items-center justify-end mt-2">
                        <Button 
                          size="sm" 
                          variant={isSelected ? "default" : "secondary"} 
                          className="h-7 w-7 p-0 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(q.id);
                          }}
                        >
                          {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {!isPending && questions.length === 0 && (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
                    {t("noQuestionsFound")}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
