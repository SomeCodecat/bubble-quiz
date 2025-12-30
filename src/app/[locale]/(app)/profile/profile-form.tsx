"use client"

import { useState } from "react"
import { updateProfile } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

import { AvatarPicker } from "@/components/profile/avatar-picker"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { LanguageToggle } from "@/components/ui/language-toggle"
import { useTranslations } from "next-intl"

export function ProfileForm({ user }: { user: any }) {
  const t = useTranslations('Profile')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")
  const [avatarUrl, setAvatarUrl] = useState(user.image || "")
  const { update } = useSession()
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMsg("")
    
    // Optimistic update?
    const newUsername = formData.get("username") as string
    const newImage = formData.get("image") as string // AvatarPicker puts it in hidden input
    
    const res = await updateProfile(formData)
    
    if (res.error) {
       // Simple mapping for demo, usually error codes
       setMsg(res.error === 'Username taken' ? t('usernameTaken') : res.error)
    } else {
       setMsg(t('saved'))
       await update({ username: newUsername, image: newImage })
       router.refresh()
    }
    setLoading(false)
  }

  return (
    <form action={handleSubmit} className="space-y-6">
       
       <AvatarPicker 
          currentAvatar={user.image} 
          onAvatarChange={setAvatarUrl}
       />

       <div className="grid gap-2">
         <Label>{t('email')}</Label>
         <Input disabled value={user.email || ""} className="bg-muted/50" />
       </div>
       
       <div className="grid gap-2">
         <Label>{t('username')}</Label>
         <Input name="username" defaultValue={user.username || ""} required minLength={3} className="bg-background"/>
       </div>

       <div className="grid gap-2">
         <Label>Bio</Label>
         <Textarea name="bio" defaultValue={user.bio || ""} className="bg-background resize-none" placeholder="Tell us about yourself..." />
       </div>

       <div className="flex items-center space-x-2">
          <Checkbox id="isPublic" name="isPublic" defaultChecked={user.isPublic} />
          <Label htmlFor="isPublic">Public Profile</Label>
       </div>

       <div className="grid gap-2 pt-2 border-t">
          <Label className="mb-2">{t('customization')}</Label>
          <div className="flex items-center justify-between p-3 border rounded-md bg-card">
              <span className="text-sm text-muted-foreground">{t('theme')}</span>
              <ThemeToggle />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md bg-card">
              <span className="text-sm text-muted-foreground">{t('language')}</span>
              <LanguageToggle />
          </div>
       </div>

       {msg && (
         <p className={`text-sm ${msg === t('saved') ? 'text-green-500' : 'text-red-500'}`}>
            {msg}
         </p>
       )}

       <div className="flex justify-end">
         <Button type="submit" isLoading={loading}>
            {loading ? t('saving') : t('save')}
         </Button>
       </div>
    </form>
  )
}
