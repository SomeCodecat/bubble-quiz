"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  getCollectionDeletionAnalysis,
  deleteCollection,
} from "@/app/[locale]/(app)/collections/actions";
import { useRouter } from "@/i18n/routing";

interface Props {
  collectionId: string;
  collectionName: string;
}

export function DeleteCollectionDialog({
  collectionId,
  collectionName,
}: Props) {
  const t = useTranslations("Collections");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    totalQuestions: number;
    userOwnedQuestions: number;
    deletableQuestions: number;
    safeQuestions: number;
  } | null>(null);
  const [deleteQuestions, setDeleteQuestions] = useState(false);
  const router = useRouter();

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setAnalyzing(true);
      setAnalysis(null);
      setDeleteQuestions(false);
      try {
        const result = await getCollectionDeletionAnalysis(collectionId);
        setAnalysis(result);
      } catch (e) {
        console.error(e);
        toast.error(t("analysisError"));
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await deleteCollection(collectionId, deleteQuestions);
      if (res?.error) {
        toast.error(t("deleteError") + ": " + res.error);
      } else {
        toast.success(t("deleted"));
        setOpen(false);
        router.push("/collections");
        router.refresh();
      }
    } catch (e) {
      toast.error(t("deleteError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="icon" title={t("deleteCollection")}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("deleteTitle", { name: collectionName })}
          </DialogTitle>
          <DialogDescription>{t("deleteWarning")}</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {analyzing ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("analyzing")}
            </div>
          ) : analysis ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted p-2 rounded">
                  <span className="block text-xs text-muted-foreground">
                    {t("totalQuestions")}
                  </span>
                  <span className="font-bold">{analysis.totalQuestions}</span>
                </div>
                <div className="bg-muted p-2 rounded">
                  <span className="block text-xs text-muted-foreground">
                    {t("yours")}
                  </span>
                  <span className="font-bold">
                    {analysis.userOwnedQuestions}
                  </span>
                </div>
              </div>

              {analysis.userOwnedQuestions > 0 && (
                <div className="flex items-start space-x-2 border p-3 rounded-md bg-destructive/5 border-destructive/20">
                  <Checkbox
                    id="deepDelete"
                    checked={deleteQuestions}
                    onCheckedChange={(c) => setDeleteQuestions(!!c)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="deepDelete"
                      className="font-bold text-destructive"
                    >
                      {t("alsoDeleteQuestions", {
                        count: analysis.deletableQuestions,
                      })}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("deepDeleteExplain", {
                        count: analysis.deletableQuestions,
                      })}
                      {analysis.safeQuestions > 0 && (
                        <span className="block mt-1 text-emerald-600 font-medium">
                          {t("safeGuard", { count: analysis.safeQuestions })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || analyzing}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("confirmDelete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
