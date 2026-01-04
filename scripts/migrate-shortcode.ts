import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";

const db = new PrismaClient();
const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  10
);

async function main() {
  console.log("Migrating Questions...");
  const questions = await db.question.findMany();
  for (const q of questions) {
    if (!q.shortCode || q.shortCode.length > 12) {
      const code = nanoid();
      console.log(`Updating Question ${q.id} -> ${code}`);
      await db.question.update({
        where: { id: q.id },
        data: { shortCode: code },
      });
    }
  }

  console.log("Migrating Collections...");
  const collections = await db.collection.findMany();
  for (const c of collections) {
    if (!c.shortCode || c.shortCode.length > 12) {
      const code = nanoid();
      console.log(`Updating Collection ${c.id} -> ${code}`);
      await db.collection.update({
        where: { id: c.id },
        data: { shortCode: code },
      });
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
