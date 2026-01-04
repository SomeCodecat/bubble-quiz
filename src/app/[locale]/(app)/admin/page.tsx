import { db } from "@/lib/db";
import { Link } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "./users-tab";
import { SettingsTab } from "./settings-tab";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect({ href: "/", locale: "en" });
  }

  const t = await getTranslations("Admin");

  // Fetch data
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">{t("usersTab")}</TabsTrigger>
          <TabsTrigger value="settings">{t("settingsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/questions" className="block group">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle>Manage Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    View, edit, and manage all questions (active and deleted).
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/collections" className="block group">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle>Manage Collections</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Organize questions into collections and manage access.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UsersTab users={users} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
