import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ExportButton } from "@/components/quiz/export-button";
import { QuestionList } from "./question-list";
import { getTrashedQuestions } from "./actions"; // Import the new action
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";
import { QuestionRestoreButton } from "./question-actions-client"; // Ensure this matches export
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QuestionsPage({ searchParams }: Props) {
  const session = await auth();
  const t = await getTranslations("Questions");

  if (!session?.user?.id) {
    redirect({ href: "/api/auth/signin", locale: "en" });
    return null;
  }

  // Fetch ACTIVE questions
  const activeQuestions = await db.question.findMany({
    where: {
      deletedAt: null,
      OR: [{ isLocked: false }, { creatorId: session.user.id }],
    },
    include: {
      creator: {
        select: { name: true, username: true },
      },
      deletedBy: {
        select: { id: true, name: true, username: true },
      },
      owner: {
        select: { id: true, name: true, username: true },
      },
      tags: {
        include: { tag: true },
      },
      collections: {
        include: { collection: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const parsedQuestions = activeQuestions.map((q) => ({
    ...q,
    options: JSON.parse(q.options) as string[],
  }));

  const allTags = await db.tag.findMany({
    orderBy: { name: "asc" },
  });

  const exportData = activeQuestions.map((q) => {
    let options = [];
    try {
      options = JSON.parse(q.options);
    } catch (e) {
      options = [];
    }
    return {
      text: q.text,
      options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      category: q.category,
    };
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-[90vw] space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={exportData}
              filename="questions.json"
              label={t("export")}
            />
            <Link href="/questions/create">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                {t("add")}
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active">{t("active")}</TabsTrigger>
            <TabsTrigger value="trash" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {t("trash")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <QuestionList
              questions={parsedQuestions}
              allTags={allTags}
              currentUserId={session.user.id}
              isAdmin={session.user.role === "ADMIN"}
            />
          </TabsContent>

          <TabsContent value="trash">
            {await (async () => {
              const trash = await getTrashedQuestions();
              if (trash.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    {t("emptyTrash")}
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trash.map((q) => (
                    <Card
                      key={q.id}
                      className="opacity-75 hover:opacity-100 transition-opacity border-dashed"
                    >
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
                          {q.text}
                        </CardTitle>
                        <QuestionRestoreButton questionId={q.id} />
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">
                        <p>
                          {t("deletedBy", {
                            name: q.deletedBy?.username || t("unknown"),
                          })}
                        </p>
                        {q.creatorId === session.user.id && (
                          <span className="inline-block mt-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-emerald-500/20">
                            {t("me")}
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
