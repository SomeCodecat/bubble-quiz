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
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";

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

export function QuestionForm({
  initialData,
  onSubmit,
  title,
  submitLabel,
  availableCollections = [],
}: Props) {
  const t = useTranslations("Questions");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
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
          />
        </div>

        <div className="space-y-2">
          <Label>{t("tagsLabel")}</Label>
          <Input
            name="tags"
            placeholder={t("tagsPlaceholder")}
            className="bg-background"
            defaultValue={initialData?.tags?.join(", ")}
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

      {availableCollections.length > 0 && (
        <div className="space-y-3 border p-4 rounded-md bg-muted/20">
          <Label>{t("collectionsLabel")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {availableCollections.map((col) => (
              <div key={col.id} className="flex items-center space-x-2">
                <Checkbox
                  name="collections"
                  value={col.id}
                  defaultChecked={initialData?.collectionIds?.includes(col.id)}
                />
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
