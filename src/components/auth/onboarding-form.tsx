"use client"

import { updateUsername } from "@/app/[locale]/onboarding/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { useRouter } from "@/i18n/routing"
import { useSession, signOut } from "next-auth/react"

interface OnboardingFormProps {
  defaultUsername: string;
}

export function OnboardingForm({ defaultUsername }: OnboardingFormProps) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { update } = useSession()

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    setError("")
    
    
    const res = await updateUsername(formData)
    
    if (res.error) {
      console.error("Update failed:", res.error);
      setError(res.error)
      setLoading(false)
    } else {
      await update({ username: res.username })
      router.refresh()
      router.push("/") 
    }
  }

  return (
    <Card className="max-w-md w-full bg-card border-border shadow-xl">
      <CardHeader>
        <CardTitle className="text-center">Choose your Username</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <Input 
              name="username" 
              placeholder={defaultUsername} 
              required 
              minLength={3} 
              className="bg-background"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="grid gap-2">
            <Button type="submit" className="w-full" isLoading={loading}>
              {loading ? "Saving..." : "Start Playing"}
            </Button>
            
            <div className="text-center text-xs text-muted-foreground my-1">
              or
            </div>

            <Button 
               type="submit"
               variant="secondary"
               className="w-full" 
               disabled={loading}
               onClick={(e) => {
                 // Prevent default form submit? No, we want to submit with the default value.
                 // Actually this button inside form defaults to submit. 
                 // But we want to ensure it uses the default value if the user cleared it?
                 // Simplest: Just let it submit the form. The input has defaultValue.
                 // If the user CLEARED the input, then 'required' will block it locally.
                 // User request: "Skip adding username"
                 // So we should maybe bypass the input validation if they click this?
                 // Let's just reset the input to default and submit.
                 const form = e.currentTarget.closest('form');
                 if (form) {
                    const input = form.querySelector('input[name="username"]') as HTMLInputElement;
                    if (input) input.value = defaultUsername;
                 }
               }}
            >
               Skip and use "{defaultUsername}"
            </Button>
          </div>
        </form>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Wrong Account?</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          Sign Out
        </Button>
      </CardContent>
    </Card>
  )
}
