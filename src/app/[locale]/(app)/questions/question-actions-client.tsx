"use client";

import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { deleteQuestion, restoreQuestion } from "./actions";
import { useTranslations } from "next-intl";

interface DeleteProps {
  questionId: string;
}

export function QuestionRestoreButton({ questionId }: DeleteProps) {
  const t = useTranslations("Questions");
  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const result = await restoreQuestion(questionId);
      if (result.error) {
        toast.error(t("restoreError"));
      } else {
        toast.success(t("restored"));
      }
    } catch (e) {
      toast.error(t("restoreError"));
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
      onClick={handleRestore}
      title={t("restore")}
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  );
}

export function QuestionDeleteButton({ questionId }: DeleteProps) {
  const t = useTranslations("Questions");
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const result = await deleteQuestion(questionId);
      if (result.error) {
        toast.error(t("deleteError"));
      } else {
        toast.success(t("deleted"));
      }
    } catch (e) {
      toast.error(t("deleteError"));
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
      onClick={handleDelete}
      title={t("delete")}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
