import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createQuestion } from "@/app/[locale]/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateQuestionView } from "./create-question-view";

export default async function CreateQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const { collectionId } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/api/auth/signin", locale: "en" });
  }

  const t = await getTranslations("Admin");

  const availableCollections = await db.collection.findMany({
    where: {
      OR: [{ isLocked: false }, { creatorId: session?.user?.id || "" }],
    },
    select: { id: true, name: true },
  });

  const availableTags = await db.tag.findMany({
    select: { name: true },
    orderBy: { questions: { _count: "desc" } },
    take: 50,
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-8 flex justify-center">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <Link href="/questions">
              <Button variant="ghost" size="icon">
                <ArrowLeft />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
              {t("addQuestion")}
            </h1>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        <CreateQuestionView
          availableCollections={availableCollections}
          createQuestionAction={createQuestion}
          preselectedCollectionId={collectionId}
          availableTags={availableTags.map((t) => t.name)}
        />
      </div>
    </div>
  );
}
