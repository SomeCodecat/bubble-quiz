"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { updateUserRole } from "./actions";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  role: string;
  gamesPlayed: number;
  totalScore: number;
  createdAt: Date;
}

import { useTranslations } from "next-intl";

export function UsersTab({ users }: { users: User[] }) {
  const t = useTranslations("Admin");
  const [filter, setFilter] = useState("");

  const filtered = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(filter.toLowerCase()) ||
      u.email?.toLowerCase().includes(filter.toLowerCase()) ||
      u.name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("searchUsers")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("registeredUsers")} ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("usersTab")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("games")}</TableHead>
                  <TableHead>{t("score")}</TableHead>
                  <TableHead>{t("joined")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{user.username || t("noUsername")}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <span>{user.role}</span>
                      {/* Prevent changing own role if current user (client-side check strictly for UI) */}
                      {/* Ideally pass currentUserId prop or handle in server action result */}
                      <form
                        action={async () => {
                          // Simple optimistic toggle for MVP
                          const newRole =
                            user.role === "ADMIN" ? "USER" : "ADMIN";
                          await updateUserRole(user.id, newRole);
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] uppercase tracking-wider border"
                        >
                          {user.role === "ADMIN" ? t("demote") : t("promote")}
                        </Button>
                      </form>
                    </TableCell>
                    <TableCell>{user.gamesPlayed}</TableCell>
                    <TableCell>{user.totalScore}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      {t("noUsers")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
