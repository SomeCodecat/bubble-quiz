"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const nextLocale = locale === "en" ? "de" : "en";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <Button
      variant="ghost"
      onClick={toggle}
      className="font-bold uppercase text-muted-foreground hover:text-foreground"
    >
      {locale === "en" ? "DE" : "EN"}
    </Button>
  );
}
