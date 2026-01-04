"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Copy, Upload, FileText } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { createCollection } from "./actions";
import { importJSON } from "./import-actions";

interface Props {
  existingTags: string[];
}

export function CreateCollectionDialog({ existingTags }: Props) {
  const t = useTranslations("Collections");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  // Prompt generation state
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("30");
  const [difficulty, setDifficulty] = useState("mixed");
  const [language, setLanguage] = useState(locale);

  const generatePrompt = () => {
    return `
You are a content generator for the Bubble Quiz app.
Please generate a valid JSON for a single question collection (not a full game/quiz configuration, just the collection of questions).
Topic: ${topic || "General Knowledge"}
Number of questions: ${count}
Difficulty: ${difficulty}
Language: ${language}

Please assign relevant tags to each question.
You can apply multiple relevant tags (more than 2 is fine), but do not overdo it (keep it relevant).
Prefer using these existing tags if they fit: ${existingTags.join(", ")}.
If a tag is present in English already, apply it even if the question is in another language. Do NOT create a translated tag if an English one already exists.
You can also create new tags if necessary.

Format:
{
  "name": "Collection Name",
  "description": "Short description of the collection",
  "questions": [
    {
      "text": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Optional explanation.",
      "category": "History",
      "tags": ["tag1", "tag2"]
    }
  ]
}
Output only raw JSON.
`.trim();
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatePrompt());
    toast.success(t("copiedClipboard"));
  };

  const handleManualSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      await createCollection(formData);
      setOpen(false);
      toast.success(t("created"));
    } catch (e) {
      toast.error(t("createError"));
    } finally {
      setLoading(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!jsonInput) return;
    setLoading(true);
    try {
      const res = await importJSON(jsonInput);
      if (res.error) {
        toast.error(res.error);
      } else {
        setOpen(false);
        setJsonInput("");
        toast.success(t("imported", { count: res.count || 0 }));
      }
    } catch (e) {
      toast.error(t("importError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="mr-2 h-4 w-4" /> {t("newCollection")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("createDialogTitle")}</DialogTitle>
          <DialogDescription>{t("createDialogDesc")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">{t("importTab")}</TabsTrigger>
            <TabsTrigger value="manual">{t("manualTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>{t("topic")}</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("topicPlaceholder")}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>{t("countLabel")}</Label>
                  <Input
                    type="number"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    min={1}
                    max={50}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("difficulty")}</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">{t("easy")}</SelectItem>
                      <SelectItem value="medium">{t("medium")}</SelectItem>
                      <SelectItem value="hard">{t("hard")}</SelectItem>
                      <SelectItem value="mixed">{t("mixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("language")}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-muted p-4 relative">
              <Label className="text-xs font-mono text-muted-foreground uppercase mb-2 block">
                {t("aiHelperPrompt")}
              </Label>
              <pre className="text-xs overflow-auto max-h-[100px] whitespace-pre-wrap font-mono">
                {generatePrompt()}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={copyPrompt}
                title={t("copyPrompt")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>{t("pasteJson")}</Label>
              <Textarea
                placeholder='{ "name": "...", "questions": [...] }'
                className="font-mono text-xs h-[150px]"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                onClick={handleImportSubmit}
                disabled={loading || !jsonInput}
              >
                {loading ? t("importing") : t("importJsonBtn")}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="manual">
            <form action={handleManualSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("name")}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder={t("placeholderName")}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">{t("description")}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder={t("placeholderDesc")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? t("saving") : t("createBtn")}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
