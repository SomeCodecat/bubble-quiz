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

const QuestionImportSchema = z.object({
  text: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  explanation: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const CollectionImportSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  questions: z.array(QuestionImportSchema),
});

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

export async function importJSON(
  jsonString: string,
  shouldCreateCollection: boolean = true,
  targetCollectionIds?: string[]
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  // Verify user exists in database (handle stale sessions)
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return {
      error: "User record not found. Please sign out and sign in again.",
    };
  }

  try {
    // Clean up JSON string (remove markdown code blocks if present)
    let cleanedJson = jsonString.replace(/```json\s*|\s*```/g, "").trim();

    // Extract JSON object/array if there is extra text around it
    const firstBrace = cleanedJson.indexOf("{");
    const firstBracket = cleanedJson.indexOf("[");
    const start =
      firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)
        ? firstBrace
        : firstBracket;

    const lastBrace = cleanedJson.lastIndexOf("}");
    const lastBracket = cleanedJson.lastIndexOf("]");
    const end =
      lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)
        ? lastBrace
        : lastBracket;

    if (start !== -1 && end !== -1 && start < end) {
      cleanedJson = cleanedJson.substring(start, end + 1);
    }

    const data = JSON.parse(cleanedJson);

    // Determine if single collection or array of questions
    // Simple heuristic: check if it has 'questions' array inside
    let collectionsToImport = [];

    if (data.questions && Array.isArray(data.questions)) {
      collectionsToImport.push(data);
    } else if (Array.isArray(data)) {
      // Maybe array of questions? wrap in default collection
      collectionsToImport.push({
        name: "Imported Questions " + new Date().toLocaleDateString(),
        description: "Imported from JSON",
        questions: data,
      });
    } else {
      return { error: "Invalid JSON format" };
    }

    for (const colData of collectionsToImport) {
      let collectionIds: string[] = targetCollectionIds || [];

      if (shouldCreateCollection) {
        // ... (existing logic for creating new collection)
        const existingCol = await db.collection.findFirst({
          where: {
            name: colData.name || "Imported Collection",
            creatorId: session.user.id,
            deletedAt: null,
          },
        });

        if (existingCol) {
          collectionIds.push(existingCol.id);
        } else {
          // Create Collection
          const collection = await db.collection.create({
            data: {
              name: colData.name || "Imported Collection",
              description: colData.description,
              creator: { connect: { id: session.user.id as string } },
              isLocked: true, // Default to private
            },
          });
          collectionIds.push(collection.id);
        }
      }

      // Create Questions
      for (const q of colData.questions) {
        // Validate
        const valid = QuestionImportSchema.safeParse(q);
        if (!valid.success) continue;

        const optionsStr = JSON.stringify(q.options);

        // Check for duplicate
        const existingQuestion = await db.question.findFirst({
          where: {
            text: q.text,
            options: optionsStr,
            deletedAt: null,
          },
        });

        let questionId = existingQuestion?.id;

        if (!questionId) {
          const question = await db.question.create({
            data: {
              shortCode: nanoid(),
              text: q.text,
              options: optionsStr,
              correctIndex: q.correctIndex,
              explanation: q.explanation,
              category: q.category,
              creator: { connect: { id: session.user.id as string } },
              tags: {
                create: q.tags?.map((tag: string) => ({
                  tag: {
                    connectOrCreate: {
                      where: { name: tag },
                      create: {
                        name: tag,
                        slug: slugify(tag),
                      },
                    },
                  },
                })),
              },
            },
          });
          questionId = question.id;
        } else {
          if (
            existingQuestion &&
            existingQuestion.creatorId !== session.user.id &&
            existingQuestion.isLocked
          ) {
            // Cannot reuse someone else's private question. Create a duplicate for me.
            const question = await db.question.create({
              data: {
                shortCode: nanoid(),
                text: q.text,
                options: optionsStr,
                correctIndex: q.correctIndex,
                explanation: q.explanation,
                category: q.category,
                creator: { connect: { id: session.user.id as string } },
              },
            });
            questionId = question.id;
          }
        }

        // Link to ALL target collections
        if (questionId && collectionIds.length > 0) {
          // Use createMany if supported or loop
          // QuestionCollection has composite key? No, probably ID.
          // Check Schema: QuestionCollection id @default(cuid())

          // Just loop and create, ignoring duplicates (or use connect)
          // But QuestionCollection is a join table.
          // To be safe against duplicates, we can check existing links?
          // Or just try/catch unique constraint if composite unique exists.
          // Schema has @@unique([questionId, collectionId]) likely.

          for (const colId of collectionIds) {
            // Ensure unique
            const exists = await db.questionCollection.findUnique({
              where: {
                questionId_collectionId: {
                  questionId: questionId,
                  collectionId: colId,
                },
              },
            });
            if (!exists) {
              await db.questionCollection.create({
                data: {
                  collectionId: colId,
                  questionId: questionId,
                },
              });
            }
          }
        }
      }
    }

    revalidatePath("/collections");
    revalidatePath("/questions");
    return { success: true, count: collectionsToImport.length };
  } catch (e) {
    console.error(e);
    return { error: "Failed to parse or import data" };
  }
}
