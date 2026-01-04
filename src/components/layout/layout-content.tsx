"use client";

import { useUI } from "@/components/providers/ui-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isSidebarVisible } = useUI();
  return (
    <>
      <div
        className={cn(
          "hidden md:flex w-72 flex-col fixed inset-y-0 z-50 transition-transform duration-300 ease-in-out",
          !isSidebarVisible && "-translate-x-full"
        )}
      >
        <Sidebar />
      </div>
      <main
        className={cn(
          "flex-1 h-full flex flex-col min-w-0 transition-all duration-300 ease-in-out",
          isSidebarVisible ? "md:pl-72" : "pl-0"
        )}
      >
        <ScrollArea className="flex-1 w-full h-full relative">
          <div className="min-h-full">{children}</div>
        </ScrollArea>
      </main>
    </>
  );
}
