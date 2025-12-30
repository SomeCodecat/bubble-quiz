import { db } from "@/lib/db";
import { createQuestion, deleteQuestion } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "./users-tab";
import { SettingsTab } from "./settings-tab";
import { Badge } from "@/components/ui/badge";

// ... imports
import { restoreQuestion } from "./actions";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect({ href: "/", locale: "en" });
  }

  const t = await getTranslations("Admin");

  // Fetch data
  const [activeQuestions, archivedQuestions, users] = await Promise.all([
    db.question.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    db.question.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    }),
    db.user.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions">
            {t("questionsTab")} ({activeQuestions.length})
          </TabsTrigger>
          <TabsTrigger value="archived">
            {t("archivedTab")} ({archivedQuestions.length})
          </TabsTrigger>
          <TabsTrigger value="users">{t("usersTab")}</TabsTrigger>
          <TabsTrigger value="settings">{t("settingsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>{t("addQuestion")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={createQuestion as any} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("questionText")}</Label>
                      <Input
                        name="text"
                        placeholder={t("questionPlaceholder")}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("category")}</Label>
                      <Input
                        name="category"
                        placeholder={t("categoryPlaceholder")}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                          <Label>{t("optionLabel", { number: i + 1 })}</Label>
                          <Input
                            name={`option${i}`}
                            placeholder={t("optionPlaceholder", {
                              number: i + 1,
                            })}
                            required
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label>{t("correctAnswer")}</Label>
                      <Select name="correctIndex" required defaultValue="0">
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectCorrect")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">
                            {t("optionSelect", { number: 1 })}
                          </SelectItem>
                          <SelectItem value="1">
                            {t("optionSelect", { number: 2 })}
                          </SelectItem>
                          <SelectItem value="2">
                            {t("optionSelect", { number: 3 })}
                          </SelectItem>
                          <SelectItem value="3">
                            {t("optionSelect", { number: 4 })}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button type="submit" className="w-full">
                      Add Question
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>
                    {t("existingQuestions")} ({activeQuestions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[600px] overflow-y-auto space-y-4 pr-2">
                  {activeQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="p-3 bg-muted border border-border rounded flex justify-between items-start"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="font-semibold truncate">{q.text}</p>
                        {q.category && (
                          <Badge variant="outline" className="mt-1">
                            {q.category}
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Correct: {JSON.parse(q.options)[q.correctIndex]}
                        </p>
                      </div>
                      <form action={deleteQuestion.bind(null, q.id) as any}>
                        <Button variant="destructive" size="sm">
                          {t("delete")}
                        </Button>
                      </form>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <CardTitle>Archived Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {archivedQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between p-2 border rounded bg-muted/50 opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <div>
                      <span className="line-through text-muted-foreground">
                        {q.text}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        Deleted: {q.deletedAt?.toLocaleDateString()}
                      </div>
                    </div>
                    <form action={restoreQuestion.bind(null, q.id) as any}>
                      <Button variant="outline" size="sm">
                        Restore
                      </Button>
                    </form>
                  </div>
                ))}
                {archivedQuestions.length === 0 && (
                  <div className="text-muted-foreground">
                    No archived questions.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <UsersTab users={users} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
