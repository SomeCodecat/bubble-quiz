"use client";

import { registerUser } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";

interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const authT = useTranslations("Auth");
  const commonT = useTranslations("Lobby");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");

    const res = await registerUser(formData);

    if (res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/login");
      }
    }
  };

  return (
    <div className="space-y-6 py-4">
      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{authT("emailLabel")}</label>
          <Input
            name="username"
            placeholder="CoolPlayer123"
            required
            minLength={3}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input
            name="email"
            type="email"
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
            minLength={6}
            className="bg-background"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button type="submit" className="w-full" isLoading={loading}>
          {loading ? authT("signingIn") : authT("register")}
        </Button>
      </form>

      <div className="text-center text-sm">
        {authT("hasAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {authT("login")}
        </Link>
      </div>
    </div>
  );
}
