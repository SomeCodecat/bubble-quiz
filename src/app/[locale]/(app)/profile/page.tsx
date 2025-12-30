import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "@/i18n/routing"
import { updateProfile } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { LanguageToggle } from "@/components/ui/language-toggle"
import { ProfileForm } from "./profile-form"

import { getTranslations } from 'next-intl/server'

export default async function ProfilePage() {
  const session = await auth()
  const t = await getTranslations('Profile')
  if (!session?.user?.id) {
    redirect({ href: "/", locale: "en" })
    return null; // TS Guard
  }
  
  const user = await db.user.findUnique({ 
    where: { id: session.user.id },
    include: {
        gameHistory: {
            take: 10,
            orderBy: { playedAt: 'desc' }
        }
    }
  })

  // Safe fallback if DB user missing (should conform to auth phantom check but handled loosely here)
  if (!user) return <div>User not found</div>

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-2xl space-y-8">
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <h1 className="text-3xl font-bold">{t('title')}</h1>
             {user.isPublic && <Badge variant="secondary">Public</Badge>}
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>


        <div className="grid gap-6 md:grid-cols-2">
          {/* Stats Card */}
          <Card className="bg-card border-border shadow-md md:col-span-2">
            <CardHeader className="pb-2">
               <CardTitle className="text-lg text-muted-foreground uppercase tracking-wider">{t('performance')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="bg-muted match-bg rounded-lg p-4 text-center">
                 <div className="text-3xl font-black">{user.gamesPlayed}</div>
                 <div className="text-xs text-muted-foreground uppercase font-bold">{t('gamesPlayed')}</div>
              </div>
              <div className="bg-muted match-bg rounded-lg p-4 text-center">
                 <div className="text-3xl font-black">{user.totalScore}</div>
                 <div className="text-xs text-muted-foreground uppercase font-bold">{t('totalScore')}</div>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card className="bg-card border-border shadow-xl md:col-span-2 lg:col-span-1">
             <CardHeader>
               <CardTitle>{t('accountDetails')}</CardTitle>
               <CardDescription>{t('updateInfo')}</CardDescription>
             </CardHeader>
             <CardContent>
               <ProfileForm user={user} />
             </CardContent>
          </Card>

          {/* Recent Games */}
          <Card className="bg-card border-border shadow-xl md:col-span-2 lg:col-span-1">
             <CardHeader>
               <CardTitle>{t('recentGames')}</CardTitle>
               <CardDescription>{t('last10Games')}</CardDescription>
             </CardHeader>
             <CardContent>
                <div className="space-y-4">
                    {user.gameHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('noGames')}</p>
                    ) : (
                        user.gameHistory.map((game) => (
                            <div key={game.id} className="flex justify-between items-center bg-muted/30 p-2 rounded">
                                <div>
                                    <div className="font-bold">{t('rank')} #{game.rank}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {game.playedAt.toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono font-bold text-emerald-500">+{game.score} {t('pts')}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
             </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
