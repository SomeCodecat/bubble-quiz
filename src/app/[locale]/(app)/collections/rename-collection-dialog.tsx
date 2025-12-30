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
import { renameCollection } from "./actions";
import { toast } from "sonner";

interface RenameCollectionDialogProps {
  collectionId: string;
  currentName: string;
}

export function RenameCollectionDialog({
  collectionId,
  currentName,
}: RenameCollectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);

  const handleRename = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await renameCollection(collectionId, name);
      toast.success("Collection renamed");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to rename collection");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Rename Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Collection Name"
            />
          </div>
          <Button
            onClick={handleRename}
            disabled={isLoading || !name.trim()}
            className="w-full"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
