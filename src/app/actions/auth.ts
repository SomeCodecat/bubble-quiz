"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/lib/auth";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3),
});

export async function registerUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  const validation = registerSchema.safeParse({ email, password, username });

  if (!validation.success) {
    return { error: "Invalid input data" };
  }

  try {
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return { error: "Email or Username already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name: username, // Default name to username
      },
    });

    return { success: true };
  } catch (e) {
    return { error: "Registration failed" };
  }
}

export async function signInAction(provider: string) {
  console.log("[Auth] signInAction called for:", provider);
  await signIn(provider, { redirectTo: "/lobby" });
}

export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/lobby",
    });
  } catch (error: any) {
    if (error.type === "CredentialsSignin") {
      return { error: "Invalid credentials" };
    }
    // NextAuth redirects by throwing an error, so we need to rethrow it
    // if it's a redirect error (success case)
    if (error.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    return { error: "Login failed" };
  }
}
