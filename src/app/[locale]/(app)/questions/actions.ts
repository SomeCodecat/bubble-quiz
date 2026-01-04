"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  10
);

export async function toggleLock(questionId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const question = await db.question.findUnique({
    where: { id: questionId },
  });

  if (!question) return { error: "Not found" };

  // Only creator (or admin) can lock/unlock
  if (question.creatorId !== session.user.id && session.user.role !== "ADMIN") {
    return { error: "Forbidden" };
  }

  if (question.isLocked) {
    // Unlocking
    // Check if it belongs to any Locked Collections
    const lockedCollections = await db.collection.count({
      where: {
        isLocked: true,
        questions: { some: { questionId: questionId } },
      },
    });

    // If it is in a locked collection, we must make it Permanently Public to override the lock.
    // Otherwise, we just unlock it normally.
    const shouldMakePublic = lockedCollections > 0;

    await db.question.update({
      where: { id: questionId },
      data: {
        isLocked: false,
        isPermanentlyPublic: shouldMakePublic,
        ownerId: null,
      },
    });
  } else {
    // Locking
    if (question.isPermanentlyPublic) {
      // Permanently Public questions cannot be locked again, unless by ADMIN
      if (session.user.role !== "ADMIN") {
        return { error: "Cannot lock a permanently public question" };
      }
      // Admin override: Fall through to lock logic
    }

    // Lock and reset owner to creator
    await db.question.update({
      where: { id: questionId },
      data: {
        isLocked: true,
        isPermanentlyPublic: false,
        ownerId: question.creatorId,
      },
    });
  }

  revalidatePath("/questions");
  return { success: true };
}

export async function restoreQuestion(questionId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const question = await db.question.findUnique({
    where: { id: questionId },
  });

  if (!question) return { error: "Not found" };

  // Only creator or admin can restore, OR if it was public
  if (
    question.creatorId !== session.user.id &&
    session.user.role !== "ADMIN" &&
    question.isLocked
  ) {
    return { error: "Forbidden" };
  }

  await db.question.update({
    where: { id: questionId },
    data: {
      deletedAt: null,
      deletedById: null,
    },
  });

  revalidatePath("/questions");
  return { success: true };
}

export async function deleteQuestion(questionId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const question = await db.question.findUnique({
    where: { id: questionId },
  });

  if (!question) return { error: "Not found" };

  if (question.creatorId !== session.user.id && session.user.role !== "ADMIN") {
    return { error: "Forbidden" };
  }

  await db.question.update({
    where: { id: questionId },
    data: {
      deletedAt: new Date(),
      deletedById: session.user.id,
    },
  });

  revalidatePath("/questions");
  return { success: true };
}

const SingleQuestionSchema = z.object({
  text: z.string().min(1),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().min(0),
  explanation: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function importSingleQuestion(jsonString: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    return { error: "Invalid JSON format" };
  }

  const result = SingleQuestionSchema.safeParse(data);
  if (!result.success) {
    return { error: "Invalid data structure: " + result.error.message };
  }

  const q = result.data;

  try {
    await db.question.create({
      data: {
        text: q.text,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        category: q.category,
        creatorId: session.user.id as string,
        isLocked: false,
        tags: q.tags
          ? {
              create: q.tags.map((t) => ({
                tag: {
                  connectOrCreate: {
                    where: { name: t },
                    create: {
                      name: t,
                      slug: t.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                    },
                  },
                },
              })),
            }
          : undefined,
      },
    });

    revalidatePath("/questions");
    return { success: true };
  } catch (e) {
    console.error("Import error:", e);
    return { error: "Database error during import" };
  }
}

export async function getTrashedQuestions() {
  const session = await auth();
  if (!session?.user) return [];

  const whereClause: any = {
    deletedAt: { not: null },
  };

  if (session.user.role !== "ADMIN") {
    // Users normally only see their own trashed items
    // But per previous logic: "User: isLocked: false OR deletedById: user.id"
    // Actually for trash, usually you only see what YOU deleted or what you OWNED.
    // Let's stick to: You see your own deleted questions.
    whereClause.OR = [
      { creatorId: session.user.id },
      { deletedById: session.user.id },
      { isLocked: false },
    ];
  }

  const questions = await db.question.findMany({
    where: whereClause,
    include: {
      creator: { select: { name: true, username: true } },
      deletedBy: { select: { username: true } },
      collections: { include: { collection: true } },
    },
    orderBy: { deletedAt: "desc" },
  });

  // Parse options for consistency if needed, though usually just list view in trash
  return questions.map((q) => ({
    ...q,
    options: JSON.parse(q.options) as string[],
  }));
}
