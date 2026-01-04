import { db } from "./src/lib/db";

async function checkUsers() {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      password: true,
    },
  });
  console.log(
    "Users in DB:",
    users.map((u) => ({ ...u, hasPassword: !!u.password, password: undefined }))
  );
}

checkUsers()
  .catch(console.error)
  .finally(() => process.exit(0));
