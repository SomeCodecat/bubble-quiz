"use server"

import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3),
})

export async function registerUser(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const username = formData.get("username") as string

  const validation = registerSchema.safeParse({ email, password, username })

  if (!validation.success) {
    return { error: "Invalid input data" }
  }

  try {
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    })

    if (existingUser) {
      return { error: "Email or Username already exists" }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await db.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name: username, // Default name to username
      }
    })

    return { success: true }
  } catch (e) {
    return { error: "Registration failed" }
  }
}
