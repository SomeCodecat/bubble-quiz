"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { updateCollection } from "./actions";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";

interface EditCollectionDialogProps {
  collectionId: string;
  currentName: string;
  currentDescription?: string | null;
  variant?: "icon" | "full";
}

export function EditCollectionDialog({
  collectionId,
  currentName,
  currentDescription,
  variant = "icon",
}: EditCollectionDialogProps) {
  const t = useTranslations("Collections");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await updateCollection(collectionId, name, description);
      toast.success(t("saved") || "Collection updated");
      setOpen(false);
    } catch (error) {
      toast.error(t("error") || "Failed to update collection");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 relative"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" className="flex gap-2">
            <Pencil className="h-4 w-4" />
            {t("edit") || "Edit"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t("editCollection") || "Edit Collection"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("placeholderName")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("placeholderDesc")}
              rows={3}
            />
          </div>
          <Button
            onClick={handleUpdate}
            disabled={isLoading || !name.trim()}
            className="w-full"
          >
            {isLoading ? t("saving") : t("save") || "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
