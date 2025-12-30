"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function updateUsername(formData: FormData) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  const username = formData.get("username") as string
  if (!username || username.length < 3) return { error: "Username must be at least 3 characters" }

  try {
    // Check uniqueness
    const existing = await db.user.findUnique({ where: { username } })
    if (existing) return { error: "Username already taken" }

    await db.user.update({
      where: { id: session.user.id },
      data: { username }
    })

    return { success: true, username }
  } catch (e: any) {
    console.error("Onboarding Update Error:", e);
    return { error: `Failed: ${e.message || "Unknown error"}` }
  }
}
