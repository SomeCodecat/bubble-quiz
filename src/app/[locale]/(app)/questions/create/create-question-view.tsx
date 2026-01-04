"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { QuestionForm } from "../question-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations, useLocale } from "next-intl";
import { importSingleQuestion } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Copy,
  Sparkles,
  FileJson,
  PencilLine,
  FolderPlus,
  Library,
} from "lucide-react";
import { createCollection } from "../../collections/actions";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { importJSON } from "../../collections/import-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  availableCollections: any[];
  createQuestionAction: any;
  preselectedCollectionId?: string;
  availableTags?: string[];
}

export function CreateQuestionView({
  availableCollections,
  createQuestionAction,
  preselectedCollectionId,
  availableTags = [],
}: Props) {
  const t = useTranslations("Questions");
  const tImport = useTranslations("Import");
  const router = useRouter();

  const locale = useLocale();
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("30");
  const [difficulty, setDifficulty] = useState("mixed");
  const [language, setLanguage] = useState(locale);
  const [shouldCreateCollection, setShouldCreateCollection] = useState(
    !preselectedCollectionId
  );
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [collName, setCollName] = useState("");
  const [collDesc, setCollDesc] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    preselectedCollectionId ? [preselectedCollectionId] : []
  );

  // Auto-sync removed to allow user override
  useEffect(() => {
    // Only parse name from JSON if we are in create mode and name is empty?
    // Or just let Preview button handle it.
  }, []);

  const generatePrompt = () => {
    const tagsList =
      availableTags.length > 0
        ? availableTags.join(", ")
        : "Anatomy, Animals, Architecture, Art, Asia, Astronomy, Biology, Books, Chemistry, Cinema, Cities, Computing, Cooking, Europe, Events, Finance, Food, Geography, Germany, Greece, History, Instruments, Internet, Invention, Italy, Japan, Literature, Mathematics, Movies, Music, Mythology, Nature, Numbers, Physics, Politics, Pop Culture, Renaissance, Science, Soccer, Space, Sports, Technology, Time, Travel, War, basic";

    return `
You are a content generator for the Bubble Quiz app.
Please generate a valid JSON for a single question collection (not a full game/quiz configuration, just the collection of questions).
Topic: ${topic || "General Knowledge"}
Number of questions: ${count}
Difficulty: ${difficulty}
Language: ${language}

Please assign relevant tags to each question.
You can apply multiple relevant tags (more than 2 is fine), but do not overdo it (keep it relevant).
Prefer using these existing tags if they fit: ${tagsList}.
If a tag is present in English already, apply it even if the question is in another language. Do NOT create a translated tag if an English one already exists.
You can also create new tags if necessary.

Format:
{
  "name": "${topic || "Collection Name"}",
  "description": "Short description of the collection",
  "questions": [
    {
      "text": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Optional explanation.",
      "category": "${topic || "General"}",
      "tags": ["tag1", "tag2"]
    }
  ]
}
Output only raw JSON.
`.trim();
  };

  // Update prompt when options change
  useEffect(() => {
    setGeneratedPrompt(generatePrompt());
  }, [topic, count, difficulty, language]);

  const copyPrompt = () => {
    const p = generatedPrompt || generatePrompt();
    navigator.clipboard.writeText(p);
    toast.success(tImport("promptCopied"));
  };

  return (
    <Tabs defaultValue="llm" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
        <TabsTrigger
          value="llm"
          className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">{tImport("tabs.ai")}</span>
        </TabsTrigger>
        <TabsTrigger
          value="manual"
          className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2"
        >
          <PencilLine className="h-4 w-4" />
          <span className="hidden sm:inline">{tImport("tabs.manual")}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="llm" className="mt-6 space-y-6">
        {/* Step 1: Generate Prompt */}
        <Card className="border-2 border-primary/10 shadow-lg overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              {tImport("step1.title")}
            </CardTitle>
            <CardDescription>{tImport("step1.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2 space-y-2">
                <Label>{tImport("topicLabel")}</Label>
                <Input
                  placeholder={tImport("topicPlaceholder")}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{tImport("countLabel")}</Label>
                <Input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  min={1}
                  max={50}
                />
              </div>
              <div className="space-y-2">
                <Label>{tImport("difficultyLabel")}</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tImport("language")}</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-xs font-mono h-32 overflow-auto whitespace-pre-wrap border">
                {generatedPrompt}
              </pre>
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2 gap-2"
                onClick={copyPrompt}
              >
                <Copy className="h-4 w-4" /> {tImport("copyPrompt")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Import & Preview */}
        <Card className="border-2 border-primary/10 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-6 w-6 text-primary" />
              {tImport("step2.title")}
            </CardTitle>
            <CardDescription>{tImport("step2.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-6">
              {/* Create Collection Toggle Block */}
              <div className="space-y-4 border p-4 rounded-xl bg-primary/5 border-primary/20 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="create-coll-mode"
                        className="text-sm font-bold leading-none cursor-pointer"
                      >
                        {tImport("config.createMode")}
                      </Label>
                    </div>
                  </div>
                  <Switch
                    checked={shouldCreateCollection}
                    onCheckedChange={setShouldCreateCollection}
                    id="create-coll-mode"
                  />
                </div>

                {shouldCreateCollection && (
                  <div className="space-y-2 pt-2 animate-in fade-in zoom-in-95 duration-200">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                      {tImport("config.newCollectionName")}
                    </Label>
                    <Input
                      value={collName}
                      onChange={(e) => setCollName(e.target.value)}
                      className="bg-background border-primary/20 focus-visible:ring-primary/30"
                      placeholder={tImport("config.newCollectionPlaceholder")}
                    />
                  </div>
                )}
              </div>

              {/* Existing Collections Block - Greyed out if creating new */}
              <div
                className={cn(
                  "space-y-3 border p-4 rounded-xl bg-muted/20 border-dashed transition-all duration-300",
                  shouldCreateCollection &&
                    "opacity-40 pointer-events-none grayscale"
                )}
              >
                <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Library className="h-4 w-4" />
                  {tImport("config.existingMode")}
                </Label>
                <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                  {availableCollections.map((col) => (
                    <div
                      key={col.id}
                      className="flex items-center space-x-2 bg-background/50 p-2 rounded-lg border hover:bg-background transition-colors cursor-pointer"
                      onClick={() => {
                        if (shouldCreateCollection) return;
                        setSelectedCollectionIds((prev) =>
                          prev.includes(col.id)
                            ? prev.filter((id) => id !== col.id)
                            : [...prev, col.id]
                        );
                      }}
                    >
                      <Checkbox
                        id={`col-${col.id}`}
                        checked={selectedCollectionIds.includes(col.id)}
                        onCheckedChange={(checked) => {
                          if (checked)
                            setSelectedCollectionIds((prev) => [
                              ...prev,
                              col.id,
                            ]);
                          else
                            setSelectedCollectionIds((prev) =>
                              prev.filter((id) => id !== col.id)
                            );
                        }}
                        disabled={shouldCreateCollection}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label className="text-sm font-medium leading-none cursor-pointer flex-1 truncate">
                        {col.name}
                      </label>
                    </div>
                  ))}
                  {availableCollections.length === 0 && (
                    <p className="text-xs text-muted-foreground col-span-2 text-center py-4">
                      {tImport("config.noCollections")}
                    </p>
                  )}
                </div>
                {selectedCollectionIds.length === 0 &&
                  !shouldCreateCollection && (
                    <p
                      className="text-[10px] text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: tImport.raw("config.emptySelection"),
                      }}
                    />
                  )}
              </div>
            </div>

            {!previewData ? (
              <>
                <Textarea
                  className="font-mono text-xs h-[200px] bg-background/50"
                  placeholder={tImport("preview.placeholder")}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
                <Button
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(jsonInput);
                      // Normalize structure
                      const data = Array.isArray(parsed)
                        ? { name: "Imported Collection", questions: parsed }
                        : parsed;

                      setPreviewData(data);
                      setCollName(data.name || "New Collection");
                      // Also set default "Create Collection" to true if structure implies it
                      setShouldCreateCollection(true);
                      toast.success(tImport("preview.success"));
                    } catch (e) {
                      toast.error(tImport("preview.invalidJson"));
                    }
                  }}
                  disabled={!jsonInput.trim()}
                  className="w-full"
                >
                  {tImport("preview.button")}
                </Button>
              </>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewData(null)}
                  className="text-muted-foreground self-start mt-1"
                >
                  {tImport("preview.clear")}
                </Button>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
                    <span className="font-semibold text-sm">
                      {tImport("preview.questionsCount", {
                        count: previewData.questions?.length || 0,
                      })}
                    </span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto divide-y">
                    {previewData.questions?.map((q: any, i: number) => (
                      <div key={i} className="p-3 text-sm hover:bg-muted/30">
                        <p className="font-medium truncate">{q.text}</p>
                        <div className="flex gap-2 mt-1">
                          {q.options?.map((o: string, j: number) => (
                            <span
                              key={j}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                j === q.correctIndex
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                                  : "bg-muted border-transparent text-muted-foreground"
                              }`}
                            >
                              {o}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPreviewData(null)}
                  >
                    {tImport("preview.cancel")}
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    onClick={() => {
                      setLoading(true);
                      // Inject updated name into JSON
                      const finalData = { ...previewData, name: collName };
                      importJSON(
                        JSON.stringify(finalData),
                        shouldCreateCollection,
                        selectedCollectionIds
                      ).then((res) => {
                        if (res.error) {
                          toast.error(tImport("errorPrefix") + res.error);
                        } else {
                          toast.success(
                            tImport("successMsg", {
                              count: previewData.questions?.length || 0,
                            })
                          );
                          router.push("/collections");
                          router.refresh();
                        }
                        setLoading(false);
                      });
                    }}
                    disabled={loading}
                  >
                    {loading
                      ? tImport("importing")
                      : tImport("preview.confirm", {
                          count: previewData.questions?.length || 0,
                        })}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="manual" className="mt-6">
        <Tabs defaultValue="question" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="question">
              {tImport("manual.singleQuestion")}
            </TabsTrigger>
            <TabsTrigger value="collection">
              {tImport("manual.newCollection")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="question">
            <Card>
              <CardHeader>
                <CardTitle>{t("add")}</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionForm
                  onSubmit={createQuestionAction}
                  title={t("add")}
                  submitLabel={t("add")}
                  availableCollections={availableCollections}
                  initialData={
                    preselectedCollectionId
                      ? {
                          text: "",
                          options: ["", "", "", ""],
                          correctIndex: 0,
                          collectionIds: [preselectedCollectionId as string],
                          tags: [],
                          category: "",
                        }
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="collection">
            <Card>
              <CardHeader>
                <CardTitle>{tImport("manual.createCollectionTitle")}</CardTitle>
                <CardDescription>
                  {tImport("manual.createCollectionDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={async (formData) => {
                    setLoading(true);
                    try {
                      await createCollection(formData);
                      toast.success(tImport("manual.success"));
                      router.push("/collections");
                      router.refresh();
                    } catch (e: any) {
                      toast.error(e.message || tImport("manual.failed"));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>{t("name")}</Label>
                    <Input
                      name="name"
                      required
                      placeholder={t("placeholderName")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("description")}</Label>
                    <Textarea
                      name="description"
                      placeholder={t("placeholderDesc")}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading
                      ? tImport("manual.creating")
                      : tImport("manual.create")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  );
}
