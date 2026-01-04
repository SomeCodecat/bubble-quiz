"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

import { signInAction, loginUser } from "@/app/actions/auth";

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const authT = useTranslations("Auth");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    try {
      const res = await loginUser(formData);

      if (res?.error) {
        setError(
          res.error === "Invalid credentials"
            ? authT("invalidCredentials")
            : authT("errorOccurred")
        );
        setLoading(false);
      } else {
        // Success - server action will handle redirect if not thrown
        // But we rethrew redirect in the action, so it might not even return here
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
          router.push("/lobby");
        }
      }
    } catch (err: any) {
      if (err.message?.includes("NEXT_REDIRECT")) {
        // Handle redirect from server action
        if (onSuccess) onSuccess();
        router.push("/lobby");
        return;
      }
      console.error("Login catch error:", err);
      setError(authT("errorOccurred"));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{authT("emailLabel")}</label>
          <Input
            name="email"
            placeholder="you@example.com"
            required
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {authT("passwordLabel")}
          </label>
          <Input
            name="password"
            type="password"
            required
            className="bg-background"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? authT("signingIn") : authT("login")}
        </Button>
      </form>

      {process.env.NEXT_PUBLIC_ALLOW_REGISTRATION !== "false" && (
        <div className="text-center text-sm">
          {authT("noAccount")}{" "}
          <Link href="/register" className="text-primary hover:underline">
            {authT("register")}
          </Link>
        </div>
      )}

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            {authT("or")}
          </span>
        </div>
      </div>

      <form
        action={async () => {
          await signInAction("authentik");
        }}
      >
        <Button variant="outline" className="w-full" type="submit">
          {authT("authentik")}
        </Button>
      </form>
    </div>
  );
}
