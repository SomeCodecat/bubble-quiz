"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "next-intl";
import { toggleLock } from "./actions";
import { toast } from "sonner";

interface Props {
  questionId: string;
  isLocked: boolean;
  isPermanentlyPublic?: boolean;
  lockedCollections: { id: string; name: string }[];
  className?: string;
  variant?: "default" | "ghost" | "icon";
  isAdmin?: boolean;
}

export function QuestionLockToggle({
  questionId,
  isLocked,
  isPermanentlyPublic,
  lockedCollections,
  className,
  variant = "ghost",
  isAdmin = false,
}: Props) {
  const t = useTranslations("Questions");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLockClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If locked and part of locked collections, warn about making public
    if (isLocked && lockedCollections.length > 0) {
      setOpen(true);
      return;
    }

    // Otherwise, just toggle
    await performToggle();
  };

  const performToggle = async () => {
    setLoading(true);
    try {
      const result = await toggleLock(questionId);
      if (result?.success) {
        toast.success(t("lockSuccess"));
      } else {
        toast.error(t("lockError"));
      }
    } catch (e) {
      toast.error(t("lockError"));
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  if (isPermanentlyPublic && !isAdmin) {
     return (
        <Button
          variant={variant === "icon" ? "ghost" : "ghost"}
          size="icon"
          className={`${className} cursor-not-allowed opacity-50`}
          disabled
          title={t("permanentlyPublic")}
        >
           <Unlock className="h-4 w-4 text-blue-500" />
        </Button>
     );
  }

  return (
    <>
      <Button
        variant={variant === "icon" ? "ghost" : "ghost"}
        size="icon"
        className={className}
        onClick={handleLockClick}
        disabled={loading}
        title={isLocked ? "Unlock (Make Public)" : "Lock (Make Private)"}
      >
        {isLocked ? (
          <Lock className="h-4 w-4 text-amber-500" />
        ) : isPermanentlyPublic ? (
          <Unlock className="h-4 w-4 text-blue-500" />
        ) : (
          <Unlock className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("makePublicConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("makePublicConfirmDesc", {
                collection: lockedCollections[0]?.name || "Collection",
                b: (chunks) => <b>{chunks}</b>,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={performToggle}>
              {t("confirmMakePublic")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
