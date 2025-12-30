import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation" // Use standard redirect for auth flow escape
import { OnboardingForm } from "@/components/auth/onboarding-form"
import { signOut } from "@/lib/auth" // We can try server-side signout logic but client button is safer for clearing cookies.

export default async function OnboardingPage() {
  const session = await auth()
  
  // Phantom Session Check:
  // If session exists but DB user is gone (due to reset), we should force signout.
  if (session?.user?.id) {
    const dbUser = await db.user.findUnique({ 
      where: { id: session.user.id } 
    })
    
    if (!dbUser) {
      // User has cookie but no DB record.
      // We cannot easily clear cookie from Server Component without a Route Handler action or Client component.
      // We will render a "Session Invalid" state or just the form which allows Sign Out.
      return (
         <div className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground">
            <div className="max-w-md w-full text-center space-y-4">
               <h1 className="text-xl font-bold text-red-500">Session Invalid</h1>
               <p>Your session appears to be invalid (Account not found).</p>
               <OnboardingForm defaultUsername="Ghost" /> 
            </div>
         </div>
      )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
      </div>
      <div className="z-10 w-full max-w-md">
         {/* Proposed username from email or generic */}
         <OnboardingForm defaultUsername={session?.user?.email?.split('@')[0] || `Player${Math.floor(Math.random()*10000)}`} />
      </div>
    </div>
  )
}
