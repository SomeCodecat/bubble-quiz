"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";

const QuestionSchema = z.object({
  text: z.string().min(3),
  options: z.array(z.string()).min(2),
  correctIndex: z.coerce.number().min(0).max(3),
});

export async function createQuestion(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  // Allow admins OR users to create? User said "players will be able to add...".
  // For now, removing strict ADMIN check or keeping it?
  // "players will be able to add questions" -> All authenticated users.
  // Converting strict check to authenticated check.

  const rawData = {
    text: formData.get("text"),
    options: [
      formData.get("option0"),
      formData.get("option1"),
      formData.get("option2"),
      formData.get("option3"),
    ].filter(Boolean),
    correctIndex: formData.get("correctIndex"),
  };

  const result = QuestionSchema.safeParse(rawData);

  if (!result.success) {
    return { error: "Invalid data" };
  }

  const { text, options, correctIndex } = result.data;
  const tags = ((formData.get("tags") as string) || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const category = formData.get("category") as string;
  const collectionIds = formData.getAll("collections") as string[];

  let isLocked = false;
  let isPermanentlyPublic = false;

  if (collectionIds.length > 1) {
    isPermanentlyPublic = true;
    isLocked = false;
  } else if (collectionIds.length === 1) {
    const collection = await db.collection.findUnique({
      where: { id: collectionIds[0] },
      select: { isLocked: true },
    });
    if (collection?.isLocked) {
      isLocked = true;
    }
  }

  try {
    await db.question.create({
      data: {
        text,
        options: JSON.stringify(options),
        correctIndex,
        category: category || null,
        isLocked,
        isPermanentlyPublic,
        creator: { connect: { id: session.user.id } },
        tags: {
          create: tags.map((t) => ({
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
        },
        collections: {
          create: collectionIds.map((cid) => ({
            collection: { connect: { id: cid } },
          })),
        },
      },
    });
    // Revalidate paths where questions appear
    revalidatePath("/admin");
    revalidatePath("/questions");
    if (collectionIds.length > 0) {
      collectionIds.forEach((id) => revalidatePath(`/collections/${id}`));
    }
    return { success: true };
  } catch (error) {
    console.error("Create Question Error:", error);
    return { error: "Database Error" };
  }
}

// ... existing code ...

export async function updateQuestion(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing ID" };

  const rawData = {
    text: formData.get("text"),
    options: [
      formData.get("option0"),
      formData.get("option1"),
      formData.get("option2"),
      formData.get("option3"),
    ].filter(Boolean),
    correctIndex: formData.get("correctIndex"),
  };

  const result = QuestionSchema.safeParse(rawData);

  if (!result.success) {
    return { error: "Invalid data" };
  }

  const { text, options, correctIndex } = result.data;
  const tags = ((formData.get("tags") as string) || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const category = formData.get("category") as string;
  const collectionIds = formData.getAll("collections") as string[];

  try {
    // Verify ownership or ADMIN or Unlocked
    const existing = await db.question.findUnique({ where: { id } });
    if (!existing) return { error: "Not found" };

    // Allow if Owner OR Admin OR Not Locked
    const isOwner = existing.creatorId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";
    const isUnlocked = !existing.isLocked;

    if (!isOwner && !isAdmin && !isUnlocked) {
      return { error: "Unauthorized: Private question" };
    }

    let newIsLocked = existing.isLocked;
    let newIsPermanentlyPublic = existing.isPermanentlyPublic;

    if (collectionIds.length > 1) {
      newIsPermanentlyPublic = true;
      newIsLocked = false;
    } else if (collectionIds.length === 1) {
      if (newIsPermanentlyPublic) {
        newIsLocked = false;
      } else {
        const collection = await db.collection.findUnique({
          where: { id: collectionIds[0] },
          select: { isLocked: true },
        });
        if (collection) {
          newIsLocked = collection.isLocked;
        }
      }
    } else {
      // 0 collections
      if (newIsPermanentlyPublic) {
        newIsLocked = false;
      }
    }

    await db.question.update({
      where: { id },
      data: {
        text,
        options: JSON.stringify(options),
        correctIndex,
        category: category || null,
        isLocked: newIsLocked,
        isPermanentlyPublic: newIsPermanentlyPublic,
        tags: {
          deleteMany: {}, // Remove all old tags
          create: tags.map((t) => ({
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
        },
        collections: {
          deleteMany: {}, // Remove from all collections
          create: collectionIds.map((cid) => ({
            collection: { connect: { id: cid } },
          })),
        },
        editLogs: {
          create: {
            userId: session.user.id || "system",
            details: "Updated question content",
          },
        },
      },
    });

    revalidatePath("/questions");
    revalidatePath(`/questions/${id}`);
    revalidatePath("/admin");
    if (collectionIds.length > 0) {
      collectionIds.forEach((id) => revalidatePath(`/collections/${id}`));
    }
    return { success: true };
  } catch (error) {
    console.error("Update Question Error:", error);
    return { error: "Database Error" };
  }
}

export async function deleteQuestion(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  // Check ownership
  const existing = await db.question.findUnique({ where: { id } });
  if (!existing) return { error: "Not found" };

  if (existing.creatorId !== session.user.id && session.user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  // Soft delete
  await db.question.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/questions");
  revalidatePath("/admin");
}

export async function restoreQuestion(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return { error: "Unauthorized" };

  await db.question.update({
    where: { id },
    data: { deletedAt: null },
  });
  revalidatePath("/questions");
  revalidatePath("/admin");
}

export async function updateUserRole(
  userId: string,
  newRole: "ADMIN" | "USER"
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

  if (userId === session.user.id)
    return { error: "Cannot change your own role" };

  await db.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function getSystemSetting(key: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return null;
  }
  const setting = await db.systemSetting.findUnique({
    where: { key },
  });
  return setting?.value;
}

export async function updateSystemSetting(key: string, value: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }
  await db.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  revalidatePath("/admin");
  return { success: true };
}
