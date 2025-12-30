"use client";

import { useState } from "react";
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
import { useTranslations } from "next-intl";
import { importSingleQuestion } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

interface Props {
  availableCollections: any[];
  createQuestionAction: any;
}

const SYSTEM_PROMPT = `
You are a quiz generator helper.
Please output valid JSON for a single question for the Bubble Quiz app.
Format:
{
  "text": "Question text?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Optional explanation.",
  "category": "History",
  "tags": ["tag1", "tag2"]
}
Output only raw JSON.
`.trim();

export function CreateQuestionView({
  availableCollections,
  createQuestionAction,
}: Props) {
  const t = useTranslations("Questions");
  const tImport = useTranslations("Import");
  const router = useRouter();

  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState(SYSTEM_PROMPT);

  const handleImport = async () => {
    setLoading(true);
    const res = await importSingleQuestion(jsonInput);
    if (res.error) {
      toast.error(tImport("errorPrefix") + res.error);
    } else {
      toast.success(t("success"));
      router.push("/questions");
      router.refresh();
    }
    setLoading(false);
  };

  const handleGenerate = () => {
    const prompt = `
You are a quiz generator helper.
Please create a single multiple-choice question about "${topic}".
Output valid JSON for the Bubble Quiz app.
Format:
{
  "text": "Question text?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Optional explanation.",
  "category": "${topic}",
  "tags": ["${topic}"]
}
Output only raw JSON.
`.trim();
    setGeneratedPrompt(prompt);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    toast.success(tImport("promptCopied"));
  };

  return (
    <Tabs defaultValue="manual" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="manual">{tImport("manualTab")}</TabsTrigger>
        <TabsTrigger value="import">{tImport("importTab")}</TabsTrigger>
        <TabsTrigger value="llm">{tImport("llmTab")}</TabsTrigger>
      </TabsList>

      <TabsContent value="manual">
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
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="import">
        <Card>
          <CardHeader>
            <CardTitle>{tImport("importCardTitle")}</CardTitle>
            <CardDescription>{tImport("importCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              className="font-mono text-xs h-[300px]"
              placeholder='{ "text": "...", "options": [...] }'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <Button onClick={handleImport} disabled={loading || !jsonInput}>
              {loading ? tImport("importing") : tImport("importBtn")}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="llm">
        <Card>
          <CardHeader>
            <CardTitle>{tImport("aiCardTitle")}</CardTitle>
            <CardDescription>{tImport("aiCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tImport("topicLabel")}</Label>
              <Input
                placeholder={tImport("topicPlaceholder")}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <Button onClick={handleGenerate} disabled={!topic}>
              {tImport("generateBtn")}
            </Button>

            <div className="relative mt-4">
              <pre className="bg-muted p-4 rounded text-xs overflow-auto h-[200px] whitespace-pre-wrap">
                {generatedPrompt}
              </pre>
              <Button
                size="icon"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={copyPrompt}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
