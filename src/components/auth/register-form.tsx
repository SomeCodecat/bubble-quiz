"use client"

import { registerUser } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { useRouter } from "@/i18n/routing"
import { Link } from "@/i18n/routing"

interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    setError("")
    
    const res = await registerUser(formData)
    
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      if (onSuccess) {
        onSuccess()
      } else {
        router.push("/api/auth/signin") 
      }
    }
  }

  return (
    <div className="space-y-6 py-4">
      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Username</label>
          <Input name="username" placeholder="CoolPlayer123" required minLength={3} className="bg-background"/>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input name="email" type="email" placeholder="you@example.com" required className="bg-background"/>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Password</label>
          <Input name="password" type="password" required minLength={6} className="bg-background"/>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button type="submit" className="w-full" isLoading={loading}>
          {loading ? "Creating..." : "Sign Up"}
        </Button>
      </form>
      
      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/api/auth/signin" className="text-primary hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  )
}
