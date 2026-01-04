"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  10
);

export async function createCollection(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!name) return { error: "Name is required" };

  const collection = await db.collection.create({
    data: {
      name,
      description,
      creator: { connect: { id: session.user.id as string } },
      isLocked: false,
    },
  });

  revalidatePath("/collections");
  return { success: true, collectionId: collection.id };
}

export async function renameCollection(collectionId: string, newName: string) {
  return updateCollection(collectionId, newName, undefined);
}

export async function updateCollection(
  collectionId: string,
  name?: string,
  description?: string
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection) {
    throw new Error("Collection not found");
  }

  if (
    collection.creatorId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    throw new Error("Unauthorized");
  }

  // Check for duplicate name if name is being changed
  if (name && name !== collection.name) {
    const existing = await db.collection.findFirst({
      where: {
        name,
        creatorId: session.user.id,
        deletedAt: null,
        NOT: { id: collectionId },
      },
    });
    if (existing) {
      throw new Error("A collection with this name already exists");
    }
  }

  await db.collection.update({
    where: { id: collectionId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
    },
  });

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  return { success: true };
}

export async function toggleCollectionLock(collectionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection) return { error: "Not found" };

  if (
    collection.creatorId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    // If we want to allow editing unlocked collections, we should check !collection.isLocked here?
    // But this is Toggle Lock. Only owner should guard the lock status.
    return { error: "Forbidden" };
  }

  const newIsLocked = !collection.isLocked;

  await db.collection.update({
    where: { id: collectionId },
    data: {
      isLocked: newIsLocked,
      ownerId: newIsLocked ? collection.creatorId : null,
    },
  });

  // Rule: If Unlocking Collection -> Force Unlock all questions in it
  // Rule: If Locking Collection -> Lock all questions in it (unless permanently public)
  const qColls = await db.questionCollection.findMany({
    where: { collectionId },
    select: { questionId: true },
  });
  const qIds = qColls.map((q) => q.questionId);

  if (qIds.length > 0) {
    if (!newIsLocked) {
      // Unlocking collection -> Unlock all questions
      await db.question.updateMany({
        where: { id: { in: qIds } },
        data: {
          isLocked: false,
          ownerId: null,
        },
      });
    } else {
      // Locking collection -> Lock questions that are NOT permanently public
      // Optimization: If Admin, we lock ALL questions in the collection, resetting their status.
      // If User, we only lock those that are NOT permanently public.
      const whereClause: any = {
        id: { in: qIds },
      };
      if (session.user.role !== "ADMIN") {
        whereClause.isPermanentlyPublic = false;
      }

      // Fetch to get creatorId for owner reset
      const questionsToLock = await db.question.findMany({
        where: whereClause,
        select: { id: true, creatorId: true },
      });

      await Promise.all(
        questionsToLock.map((q) =>
          db.question.update({
            where: { id: q.id },
            data: {
              isLocked: true,
              isPermanentlyPublic: false,
              ownerId: q.creatorId,
            },
          })
        )
      );
    }
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  return { success: true };
}

// ... existing imports

export async function getCollectionDeletionAnalysis(collectionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    include: {
      questions: {
        include: {
          question: {
            include: {
              collections: true, // To check other usages
            },
          },
        },
      },
    },
  });

  if (!collection) throw new Error("Not found");

  const totalQuestions = collection.questions.length;
  let userOwnedQuestions = 0;
  let deletableQuestions = 0;
  let safeQuestions = 0;

  collection.questions.forEach((q) => {
    if (q.question.creatorId === session.user.id) {
      userOwnedQuestions++;
      // Check if used in other *active* collections
      // collection.collections includes THIS collection too, so we check if length > 1
      // AND check if those other collections are not deleted (active)

      // NOTE: q.question.collections is an array of QuestionCollection objects { questionId, collectionId }
      // We need to check if any of these link to a collection that is NOT the current one AND is NOT deleted.
      // However, we don't have the full Collection object here, just the link.
      // We need to fetch the collections to check deletedAt.
      // Optimization: We can't easily do this in a loop without N+1 queries or a better initial query.
      // Let's assume for now we just count raw links.
      // Ideally we should filter by active collections.

      // For now, let's just count raw links minus 1 (this one).
      // If > 0, it's used elsewhere.

      const otherUsages = q.question.collections.filter(
        (c) => c.collectionId !== collectionId
      ).length;

      if (otherUsages === 0) {
        deletableQuestions++;
      } else {
        safeQuestions++;
      }
    }
  });

  return {
    totalQuestions,
    userOwnedQuestions,
    deletableQuestions,
    safeQuestions,
  };
}

export async function deleteCollection(
  collectionId: string,
  deepDelete: boolean = false
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection) return { error: "Not found" };

  if (
    collection.creatorId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { error: "Forbidden" };
  }

  // Soft Delete Collection
  await db.collection.update({
    where: { id: collectionId },
    data: {
      deletedAt: new Date(),
      deletedById: session.user.id,
    },
  });

  if (deepDelete) {
    // Find questions to soft delete
    const analysis = await getCollectionDeletionAnalysis(collectionId);
    // We re-fetch or just run logic directly for safety

    // Get IDs of questions that are:
    // 1. Owned by user
    // 2. Not in other active collections
    const questions = await db.questionCollection.findMany({
      where: { collectionId },
      include: {
        question: {
          include: { collections: true },
        },
      },
    });

    const toDeleteIds: string[] = [];

    for (const qc of questions) {
      const q = qc.question;
      if (q.creatorId === session.user.id) {
        const otherUsages = q.collections.filter(
          (c) => c.collectionId !== collectionId
        ).length;
        if (otherUsages === 0) {
          toDeleteIds.push(q.id);
        }
      }
    }

    if (toDeleteIds.length > 0) {
      // updateMany does not support setting deletedById if it's a relation?
      // Actually deletedById is a String field, so it should work.
      // BUT: SQLite/Prisma sometimes has issues with updateMany on relations if not careful.
      // Let's try loop if updateMany fails or just trust it.
      // Wait, deletedById is a scalar, so updateMany is fine.

      await db.question.updateMany({
        where: { id: { in: toDeleteIds } },
        data: {
          deletedAt: new Date(),
          deletedById: session.user.id,
        },
      });
    }
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`); // Revalidate the specific page too
  return { success: true };
}

export async function addQuestionToCollection(
  collectionId: string,
  questionId: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection) return { error: "Collection not found" };

  if (
    collection.creatorId !== session.user.id &&
    session.user.role !== "ADMIN" &&
    collection.isLocked
  ) {
    return { error: "Forbidden: Collection is locked" };
  }

  // Check if question exists
  const question = await db.question.findUnique({ where: { id: questionId } });
  if (!question) return { error: "Question not found" };

  // Check if already in collection
  const exists = await db.questionCollection.findUnique({
    where: {
      questionId_collectionId: {
        questionId,
        collectionId,
      },
    },
  });

  if (exists) return { error: "Question already in collection" };

  // Check if already in ANY collection before adding
  const existingCollectionsCount = await db.questionCollection.count({
    where: { questionId },
  });

  await db.questionCollection.create({
    data: {
      collectionId,
      questionId,
    },
  });

  // Rule: If question is in multiple collections, it becomes permanently public
  if (existingCollectionsCount > 0) {
    await db.question.update({
      where: { id: questionId },
      data: { isLocked: false, isPermanentlyPublic: true },
    });
  } else {
    // Only in this collection
    if (!collection.isLocked) {
      // Collection is public -> Question public
      await db.question.update({
        where: { id: questionId },
        data: { isLocked: false },
      });
    } else {
      // Collection is locked -> Question locked (unless already permanently public)
      await db.question.updateMany({
        where: { id: questionId, isPermanentlyPublic: false },
        data: { isLocked: true },
      });
    }
  }

  revalidatePath(`/collections/${collectionId}`);
  return { success: true };
}

export async function removeQuestionFromCollection(
  collectionId: string,
  questionId: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection) return { error: "Collection not found" };

  if (
    collection.creatorId !== session.user.id &&
    session.user.role !== "ADMIN" &&
    collection.isLocked
  ) {
    return { error: "Forbidden: Collection is locked" };
  }

  await db.questionCollection.delete({
    where: {
      questionId_collectionId: {
        questionId,
        collectionId,
      },
    },
  });

  revalidatePath(`/collections/${collectionId}`);
  return { success: true };
}

export async function addQuestionsToCollection(
  collectionId: string,
  questionIds: string[]
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection) return { error: "Collection not found" };

  if (
    collection.creatorId !== session.user.id &&
    session.user.role !== "ADMIN" &&
    collection.isLocked
  ) {
    return { error: "Forbidden: Collection is locked" };
  }

  // Iterate and add. Re-using the single-add logic ensures all rules are applied correctly.
  for (const qId of questionIds) {
    try {
      await addQuestionToCollection(collectionId, qId);
    } catch (e) {
      // Ignore individual errors (like already exists)
      console.error(
        `Failed to add question ${qId} to collection ${collectionId}`,
        e
      );
    }
  }

  revalidatePath(`/collections/${collectionId}`);
  return { success: true, count: questionIds.length };
}

export async function getAvailableCollections() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const collections = await db.collection.findMany({
    where: {
      OR: [{ creatorId: session.user.id }, { isLocked: false }],
    },
    select: {
      id: true,
      name: true,
      isLocked: true,
      creator: { select: { username: true } },
      _count: { select: { questions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return collections;
}

export async function searchQuestions(
  query: string,
  collectionId?: string | null
) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const whereClause: any = {
    AND: [
      {
        OR: [{ isLocked: false }, { creatorId: session.user.id }],
      },
      { deletedAt: null },
      { text: { contains: query } },
    ],
  };

  if (collectionId) {
    whereClause.AND.push({
      collections: {
        some: { collectionId },
      },
    });
  }

  const questions = await db.question.findMany({
    where: whereClause,
    take: 50,
    include: {
      creator: { select: { username: true, name: true } },
    },
  });

  return questions;
}

export async function restoreCollection(collectionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
  });
  if (!collection) return { error: "Not found" };

  if (
    collection.deletedById !== session.user.id &&
    session.user.role !== "ADMIN" &&
    collection.isLocked
  ) {
    return { error: "Forbidden" };
  }

  await db.collection.update({
    where: { id: collectionId },
    data: { deletedAt: null, deletedById: null },
  });

  // Restore related questions logic
  // "questions should be put back in there"
  const qColls = await db.questionCollection.findMany({
    where: { collectionId },
    select: { questionId: true },
  });
  const qIds = qColls.map((q) => q.questionId);

  if (qIds.length > 0) {
    await db.question.updateMany({
      where: {
        id: { in: qIds },
        deletedAt: { not: null },
        OR: [{ deletedById: session.user.id }, { isLocked: false }],
      },
      data: { deletedAt: null, deletedById: null },
    });
  }

  revalidatePath("/collections");
  return { success: true };
}

export async function getTrashedCollections() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const whereClause: any = {
    deletedAt: { not: null },
  };

  if (session.user.role !== "ADMIN") {
    whereClause.OR = [
      { isLocked: false }, // Public at time of deletion
      { deletedById: session.user.id }, // Deleted by me
    ];
  }

  return await db.collection.findMany({
    where: whereClause,
    include: {
      creator: { select: { username: true, name: true } },
      deletedBy: { select: { username: true } },
      _count: { select: { questions: true } },
    },
    orderBy: { deletedAt: "desc" },
  });
}
