"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const ProfileSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/, "Alphanumeric only"),
  bio: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
})

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  const username = formData.get("username") as string
  const image = formData.get("image") as string // Optional
  const bio = formData.get("bio") as string
  const isPublic = formData.get("isPublic") === "on"

  const result = ProfileSchema.safeParse({ username, bio, isPublic })
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  // Debug log (remove later)
  console.log("Update Profile Data:", { 
    userId: session.user.id, 
    username: result.data.username, 
    imageLength: image?.length,
    imageStart: image?.substring(0, 50) 
  });

  try {
    // Check uniqueness
    const existing = await db.user.findUnique({
      where: { username: result.data.username },
    })
    
    // If existing user is NOT the current user
    if (existing && existing.id !== session.user.id) {
       return { error: "Username taken" }
    }

    // Verify user exists
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!currentUser) {
      return { error: "User record not found" }
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { 
        username: result.data.username,
        image: image || undefined,
        bio: result.data.bio,
        isPublic: result.data.isPublic
      }
    })
    
    revalidatePath("/profile")
    revalidatePath("/lobby") // Update lobby header
    return { success: true }
  } catch (e) {
    return { error: `Failed to update: ${(e as Error).message}` }
  }
}
