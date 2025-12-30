"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Filter, LayoutGrid, List, Grid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface Props {
  className?: string;
  filter: string;
  setFilter: (val: string) => void;
  view: "grid" | "list" | "square";
  setView: (val: "grid" | "list" | "square") => void;
  currentUserId: string;
  allTags?: { id: string; name: string }[];
  selectedTags?: string[];
  setSelectedTags?: (tags: string[]) => void;
}

export function QuestionFilterSidebar({
  className,
  filter,
  setFilter,
  view,
  setView,
  currentUserId,
  allTags = [],
  selectedTags = [],
  setSelectedTags,
}: Props) {
  const t = useTranslations("Questions");
  const [tagSearch, setTagSearch] = useState("");
  
  const toggleTag = (name: string) => {
    if (!setSelectedTags) return;
    if (selectedTags.includes(name)) {
      setSelectedTags(selectedTags.filter((t) => t !== name));
    } else {
      setSelectedTags([...selectedTags, name]);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Search className="h-4 w-4" />
          {t("search")}
        </Label>
        <Input
          placeholder={t("searchPlaceholder")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-card"
        />
      </div>

      {/* View Toggle */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          {t("view")}
        </Label>
        <div className="flex border rounded-md p-1 bg-muted/50 gap-1">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("list")}
            className="flex-1 h-8 px-2"
            title={t("list")}
          >
            <List className="h-4 w-4" />
            <span className="sr-only">{t("list")}</span>
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("grid")}
            className="flex-1 h-8 px-2"
            title={t("cards")}
          >
            <Grid className="h-4 w-4" />
            <span className="sr-only">{t("cards")}</span>
          </Button>
          <Button
            variant={view === "square" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("square")}
            className="flex-1 h-8 px-2"
            title={t("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="sr-only">{t("grid")}</span>
          </Button>
        </div>
      </div>

      {/* Tags Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Filter className="h-4 w-4" />
          {t("tags")}
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Filter tags..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            className="mb-2 h-8 text-xs"
          />
          {allTags
            .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
            .length === 0 && (
            <div className="text-xs text-muted-foreground italic">
              {t("noTags")}
            </div>
          )}
          {allTags
            .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
            .map((tag) => (
            <Badge
              key={tag.id}
              variant={selectedTags.includes(tag.name) ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/80"
              onClick={() => toggleTag(tag.name)}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
