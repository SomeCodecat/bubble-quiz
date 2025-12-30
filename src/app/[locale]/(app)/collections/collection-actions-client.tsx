"use client";

import { Button } from "@/components/ui/button";
import { Lock, Unlock, Trash2, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  toggleCollectionLock,
  addQuestionToCollection,
  restoreCollection,
} from "./actions";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { DeleteCollectionDialog } from "@/components/collections/delete-collection-dialog";

interface LockProps {
  collectionId: string;
  isLocked: boolean;
}

export function CollectionLockToggle({ collectionId, isLocked }: LockProps) {
  const t = useTranslations("Collections");
  const handleLock = async () => {
    try {
      await toggleCollectionLock(collectionId);
      toast.success(isLocked ? t("unlocked") : t("lockedMessage"));
    } catch (e) {
      toast.error(t("lockError"));
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLock}
      className="gap-2"
      title={isLocked ? t("makePublic") : t("makePrivate")}
    >
      {isLocked ? (
        <>
           <Lock className="h-4 w-4 text-amber-500" />
           <span className="text-xs">{t("private")}</span>
        </>
      ) : (
        <>
            <Unlock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs">{t("public")}</span>
        </>
      )}
    </Button>
  );
}

interface DeleteProps {
  collectionId: string;
}

export function CollectionDeleteButton({ collectionId, collectionName }: { collectionId: string, collectionName: string }) {
  return <DeleteCollectionDialog collectionId={collectionId} collectionName={collectionName} />;
}

interface AddQuestionProps {
  collectionId: string;
  questionId: string;
}

export function AddQuestionButton({
  collectionId,
  questionId,
}: AddQuestionProps) {
  const t = useTranslations("Collections");
  const handleAdd = async (formData: FormData) => {
    try {
      await addQuestionToCollection(collectionId, questionId);
      toast.success(t("questionAdded"));
    } catch (e) {
      toast.error(t("addError"));
    }
  };
  return (
    <form action={handleAdd}>
      <input type="hidden" name="questionId" value={questionId} />
      <Button size="sm" variant="secondary" className="h-7 w-7 p-0">
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function CollectionRestoreButton({ collectionId }: { collectionId: string }) {
  const t = useTranslations("Collections");
  const router = useRouter();
  const handleRestore = async () => {
    try {
      await restoreCollection(collectionId);
      toast.success(t("restored"));
      router.refresh();
    } catch (e) {
      toast.error(t("restoreError"));
    }
  };
  return (
    <Button variant="outline" size="icon" onClick={handleRestore} title={t("restore")}>
      <RotateCcw className="h-4 w-4" />
    </Button>
  );
}
