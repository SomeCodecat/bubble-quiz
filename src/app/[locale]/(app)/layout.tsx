import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
        <Sidebar isAdmin={session.user.role === "ADMIN"} user={session.user} />
      </div>
      <main className="flex-1 md:pl-64 h-full">
        <ScrollArea className="h-full w-full">{children}</ScrollArea>
      </main>
    </div>
  );
}
