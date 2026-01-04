"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";

interface AuthDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

export function AuthDialog({
  isOpen,
  onOpenChange,
  defaultTab = "login",
}: AuthDialogProps) {
  const t = useTranslations("Auth");
  const router = useRouter();

  const { update } = useSession();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            {t("login")} / {t("register")}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t("login")}</TabsTrigger>
            <TabsTrigger value="register">{t("register")}</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm
              onSuccess={async () => {
                await update();
                onOpenChange(false);
                router.refresh();
                router.push("/lobby");
              }}
            />
          </TabsContent>
          <TabsContent value="register">
            <RegisterForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
