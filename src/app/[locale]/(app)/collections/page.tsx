import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Lock, Trash2 } from "lucide-react";
import Link from "next/link";
import { ExportButton } from "@/components/quiz/export-button";
import { CreateCollectionDialog } from "./create-collection-dialog";
import { getTrashedCollections } from "./actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RenameCollectionDialog } from "./rename-collection-dialog";
import { CollectionRestoreButton } from "./collection-actions-client";

export default async function CollectionsPage() {
  const session = await auth();
  const t = await getTranslations("Collections");
  if (!session?.user?.id) {
    redirect({ href: "/api/auth/signin", locale: "en" });
    return null;
  }

  const collections = await db.collection.findMany({
    where: {
      deletedAt: null,
      OR: [{ isLocked: false }, { creatorId: session.user.id }],
    },
    include: {
      creator: { select: { name: true, username: true } },
      _count: { select: { questions: true } },
      questions: {
        include: {
          question: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const tags = await db.tag.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const tagNames = tags.map((t) => t.name);

  const exportData = collections.map((col) => ({
    name: col.name,
    description: col.description,
    questions: col.questions.map((q) => {
      let options = [];
      try {
        options = JSON.parse(q.question.options);
      } catch (e) {
        options = [];
      }
      return {
        text: q.question.text,
        options,
        correctIndex: q.question.correctIndex,
        explanation: q.question.explanation,
        category: q.question.category,
      };
    }),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-[75vw] space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>

          <div className="flex gap-2">
            <ExportButton
              data={exportData}
              filename="collections.json"
              label={t("export")}
            />
            <CreateCollectionDialog existingTags={tagNames} />
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

          <TabsContent value="active" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((col) => (
                <Link
                  href={`/collections/${col.id}`}
                  key={col.id}
                  className="block group"
                >
                  <Card className="h-full transition-all hover:border-emerald-500/50 hover:bg-muted/30">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <CardTitle className="text-xl font-bold line-clamp-1">
                          {col.name}
                        </CardTitle>
                        {col.creatorId === session.user.id && (
                          <RenameCollectionDialog
                            collectionId={col.id}
                            currentName={col.name}
                          />
                        )}
                      </div>
                      {col.isLocked && (
                        <div className="flex items-center gap-1 text-xs text-amber-500 font-mono uppercase tracking-widest shrink-0">
                          <Lock className="h-3 w-3" />
                          <span>Private</span>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm text-muted-foreground line-clamp-2 h-10 flex-1">
                          {col.description || t("noDescription")}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>
                          {t("count", { count: col._count.questions })}
                        </span>
                        <span>
                          {col.creatorId === session.user.id ? (
                            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-emerald-500/20">
                              {t("me")}
                            </span>
                          ) : (
                            t("creator", {
                              name:
                                col.creator.username ||
                                col.creator.name ||
                                t("unknown"),
                            })
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}

              {collections.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  {t("noCollections")}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="trash">
            {await (async () => {
              const trash = await getTrashedCollections();
              if (trash.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    {t("emptyTrash")}
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trash.map((col) => (
                    <Card
                      key={col.id}
                      className="opacity-75 hover:opacity-100 transition-opacity border-dashed"
                    >
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-xl font-bold line-clamp-1 text-muted-foreground">
                          {col.name}
                        </CardTitle>
                        <CollectionRestoreButton collectionId={col.id} />
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-2">
                          Deleted by {col.deletedBy?.username || "Unknown"}
                        </p>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{col._count.questions} questions</span>
                        </div>
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
