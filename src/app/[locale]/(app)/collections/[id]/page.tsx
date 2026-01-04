import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Trash2, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  CollectionLockToggle,
  CollectionDeleteButton,
} from "../collection-actions-client";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CollectionQuestionsView } from "./collection-questions-view";
import { QuestionPicker } from "../question-picker";
import { EditCollectionDialog } from "../rename-collection-dialog";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CollectionDetailsPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const t = await getTranslations("Collections");

  if (!session?.user?.id) {
    redirect({ href: "/api/auth/signin", locale: "en" });
    return null;
  }

  const collection = await db.collection.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, username: true } },
      questions: {
        include: {
          question: true,
        },
      },
    },
  });

  if (!collection) {
    notFound();
  }

  const parsedCollectionQuestions = collection.questions.map((cq) => ({
    ...cq,
    question: {
      ...cq.question,
      options: JSON.parse(cq.question.options) as string[],
    },
  }));

  const isOwner =
    collection.creatorId === session.user.id || session.user.role === "ADMIN";

  if (collection.isLocked && !isOwner) {
    redirect({ href: "/collections", locale: "en" });
  }

  const canEdit = isOwner || !collection.isLocked;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-[75vw] space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/collections">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{collection.name}</h1>
              {collection.isLocked && (
                <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full text-xs font-mono uppercase tracking-widest border border-amber-500/20">
                  <Lock className="h-3 w-3" />
                  <span>Private</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground">
              {collection.description || t("noDescription")}
            </p>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <EditCollectionDialog
                collectionId={id}
                currentName={collection.name}
                currentDescription={collection.description}
                variant="full"
              />
              <CollectionLockToggle
                collectionId={id}
                isLocked={collection.isLocked}
              />
              <CollectionDeleteButton
                collectionId={id}
                collectionName={collection.name}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Main Content: Questions in Collection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {t("questions")} ({collection.questions.length})
              </h2>
              <div className="flex gap-2">
                {canEdit && <QuestionPicker targetCollectionId={id} />}
                {canEdit && (
                  <Link href={`/questions/create?collectionId=${id}`}>
                    <Button variant="outline" className="flex gap-2">
                      <Plus className="h-4 w-4" />
                      {t("createQuestion", { defaultValue: "Create Question" })}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            {collection.questions.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center border rounded-lg bg-muted/10">
                {t("empty")}
              </div>
            ) : (
              <CollectionQuestionsView
                collectionId={id}
                questions={parsedCollectionQuestions}
                currentUserId={session.user.id}
                isAdmin={session.user.role === "ADMIN"}
                isCollectionOwner={canEdit}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
