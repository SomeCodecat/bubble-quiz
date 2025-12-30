"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RefreshCw } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"

interface AvatarPickerProps {
  currentAvatar: string | null
  onAvatarChange: (url: string) => void
}

export function AvatarPicker({ currentAvatar, onAvatarChange }: AvatarPickerProps) {
  const t = useTranslations('Profile')
  const [seed, setSeed] = useState("")
  const [previewUrl, setPreviewUrl] = useState(currentAvatar || "")

  // Initialize seed if valid dicebear url
  useEffect(() => {
    if (currentAvatar && currentAvatar.includes("api.dicebear.com")) {
       const match = currentAvatar.match(/seed=([^&]+)/)
       if (match) setSeed(match[1])
    }
  }, [currentAvatar])

  const generateAvatar = (newSeed: string) => {
    const url = `https://api.dicebear.com/9.x/dylan/svg?seed=${newSeed}`
    setPreviewUrl(url)
    onAvatarChange(url)
  }

  const handleRandomize = () => {
    const newSeed = Math.random().toString(36).substring(7)
    setSeed(newSeed)
    generateAvatar(newSeed)
  }

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSeed = e.target.value
    setSeed(newSeed)
    generateAvatar(newSeed)
  }

  return (
    <div className="space-y-4">
      <Label>Avatar</Label>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-muted bg-muted shadow-sm">
           {previewUrl ? (
             <Image 
               src={previewUrl} 
               alt="Avatar" 
               fill 
               className="object-cover"
               unoptimized // Dicebear is external
             />
           ) : (
             <div className="h-full w-full flex items-center justify-center bg-emerald-500/10 text-emerald-500 font-bold text-2xl">
               ?
             </div>
           )}
        </div>
        
        <div className="flex-1 space-y-2">
           <div className="flex gap-2">
              <Input 
                value={seed} 
                onChange={handleSeedChange} 
                placeholder="Enter seed..." 
                className="font-mono text-xs"
              />
              <Button type="button" variant="outline" size="icon" onClick={handleRandomize} title="Randomize">
                 <RefreshCw className="h-4 w-4" />
              </Button>
           </div>
           <p className="text-[10px] text-muted-foreground">
              {t('avatarStyle')}
           </p>
        </div>
      </div>
      <input type="hidden" name="image" value={previewUrl} />
    </div>
  )
}
