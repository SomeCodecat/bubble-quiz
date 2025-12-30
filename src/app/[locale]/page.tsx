import { redirect } from "@/i18n/routing";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth();

  if (session?.user) {
    redirect({ href: "/lobby", locale: "en" });
  } else {
    redirect({ href: "/lobby", locale: "en" });
  }
}
