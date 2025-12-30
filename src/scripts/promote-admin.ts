
import { db } from "@/lib/db"

async function main() {
  const email = "mlazaryev@gmail.com"
  console.log(`Promoting ${email} to ADMIN...`)
  
  try {
    const user = await db.user.upsert({
      where: { email },
      update: { role: "ADMIN" },
      create: {
        email,
        name: "Admin User",
        username: "admin",
        role: "ADMIN"
      }
    })
    console.log("Success! User updated:", user)
  } catch (error) {
    console.error("Error updating user:", error)
  }
}

main()
