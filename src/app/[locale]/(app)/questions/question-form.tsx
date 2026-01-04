"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, KeyboardEvent } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";
import { X, Sparkles, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Collection {
  id: string;
  name: string;
}

interface QuestionData {
  id?: string;
  text: string;
  options: string[];
  correctIndex: number;
  tags?: string[];
  category?: string;
  collectionIds?: string[];
}

interface Props {
  initialData?: QuestionData;
  onSubmit: (formData: FormData) => Promise<any>;
  title: string;
  submitLabel: string;
  availableCollections?: Collection[];
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim().replace(/^,|,$/g, "");
      if (newTag && !value.includes(newTag)) {
        onChange([...value, newTag]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2 p-2 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-shadow min-h-[42px]">
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="pl-2 pr-1 py-0.5 gap-1 flex items-center"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:bg-muted rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px]"
        />
      </div>
    </div>
  );
}

export function QuestionForm({
  initialData,
  onSubmit,
  title,
  submitLabel,
  availableCollections = [],
}: Props) {
  const t = useTranslations("Questions");
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [createCollection, setCreateCollection] = useState(!initialData?.id);
  const [category, setCategory] = useState(initialData?.category || "");
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    // Add tags to formData
    formData.set("tags", tags.join(","));

    try {
      await onSubmit(formData);
      toast.success(t("success"));
      router.back();
      router.refresh();
    } catch (e) {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      {initialData?.id && (
        <input type="hidden" name="id" value={initialData.id} />
      )}

      <div className="space-y-2">
        <Label>{t("questionText")}</Label>
        <Input
          name="text"
          placeholder={t("questionPlaceholder")}
          required
          className="bg-background"
          defaultValue={initialData?.text}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>{t("category")}</Label>
          <Input
            name="category"
            placeholder={t("categoryPlaceholder")}
            className="bg-background"
            defaultValue={initialData?.category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("tagsLabel")}</Label>
          <TagInput
            value={tags}
            onChange={setTags}
            placeholder={t("tagsPlaceholder")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Label>{t("optionLabel", { number: i + 1 })}</Label>
            <Input
              name={`option${i}`}
              placeholder={t("optionPlaceholder", { number: i + 1 })}
              required
              className="bg-background"
              defaultValue={initialData?.options?.[i]}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>{t("correctAnswer")}</Label>
        <Select
          name="correctIndex"
          required
          defaultValue={initialData?.correctIndex.toString() || "0"}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={t("selectCorrect")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">
              {t("optionSelect", { number: 1 })}
            </SelectItem>
            <SelectItem value="1">
              {t("optionSelect", { number: 2 })}
            </SelectItem>
            <SelectItem value="2">
              {t("optionSelect", { number: 3 })}
            </SelectItem>
            <SelectItem value="3">
              {t("optionSelect", { number: 4 })}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!initialData?.id && (
        <div className="space-y-4 border p-4 rounded-xl bg-primary/5 border-primary/20 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t("createCollectionToggle")}
                </Label>
              </div>
            </div>
            <Switch
              name="createCollection"
              checked={createCollection}
              onCheckedChange={setCreateCollection}
            />
            {/* Hidden input for form action since SwitchPrimitive.Root doesn't always populate value in FormData correctly for all next versions */}
            <input
              type="hidden"
              name="shouldCreateCollection"
              value={createCollection ? "true" : "false"}
            />
          </div>

          {createCollection && (
            <div className="space-y-2 pt-2 animate-in fade-in zoom-in-95 duration-200">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                {t("newCollectionName")}
              </Label>
              <Input
                name="newCollectionName"
                placeholder={category || t("newCollection")}
                defaultValue={category || ""}
                className="bg-background border-primary/20 focus-visible:ring-primary/30"
              />
            </div>
          )}
        </div>
      )}

      {availableCollections.length > 0 && (
        <div className="space-y-3 border p-4 rounded-xl bg-muted/20 border-dashed">
          <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Library className="h-4 w-4" />
            {t("collectionsLabel")}
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {availableCollections.map((col) => (
              <div
                key={col.id}
                className="flex items-center space-x-2 bg-background/50 p-2 rounded-lg border hover:bg-background transition-colors cursor-pointer"
                onClick={() => {
                  const cb = document.getElementById(
                    `col-${col.id}`
                  ) as HTMLInputElement;
                  if (cb) cb.click();
                }}
              >
                <Checkbox
                  id={`col-${col.id}`}
                  name="collections"
                  value={col.id}
                  defaultChecked={initialData?.collectionIds?.includes(col.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <label className="text-sm font-medium leading-none cursor-pointer flex-1 truncate">
                  {col.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full font-bold text-lg h-12"
      >
        {loading ? t("saving") : submitLabel}
      </Button>
    </form>
  );
}
