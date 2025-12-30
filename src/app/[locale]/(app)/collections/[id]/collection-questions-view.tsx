"use client";

import { QuestionList } from "../../questions/question-list";
import { removeQuestionFromCollection } from "../actions";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Props {
  collectionId: string;
  questions: any[];
  currentUserId: string;
  isAdmin: boolean;
  isCollectionOwner: boolean;
}

export function CollectionQuestionsView({
  collectionId,
  questions,
  currentUserId,
  isAdmin,
  isCollectionOwner,
}: Props) {
  const t = useTranslations("Collections");
  // Flatten the questions from QuestionCollection join table if needed,
  // BUT the parent component might have already done it?
  // Let's assume passed questions are pure Question objects.
  // If not, we map them here.
  // Checking previous file content: `collection.questions` is `{ question: Question }[]`
  // Questions passed here have parsed options
  const flatQuestions = questions.map((q) => q.question);

  const handleRemove = async (questionId: string) => {
    try {
      const result = await removeQuestionFromCollection(
        collectionId,
        questionId
      );
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t("removed"));
      }
    } catch (e) {
      toast.error(t("removeError"));
    }
  };

  return (
    <QuestionList
      questions={flatQuestions}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      hideTabs={true}
      renderActions={(question: any, isOwner: boolean) =>
        isCollectionOwner ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(question.id);
            }}
            title={t("removeTooltip")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null
      }
    />
  );
}
