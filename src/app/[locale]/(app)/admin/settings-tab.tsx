"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { getSystemSetting, updateSystemSetting } from "./actions";
import { toast } from "sonner";

export function SettingsTab() {
  const [retentionDays, setRetentionDays] = useState("7");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemSetting("trash_retention_days").then((val) => {
      if (val) setRetentionDays(val);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    try {
      const result = await updateSystemSetting(
        "trash_retention_days",
        retentionDays
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Settings saved");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const handleRunCleanup = async () => {
    try {
      const res = await fetch("/api/cron/cleanup-trash");
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Cleanup complete. Deleted ${data.deletedCount} questions.`
        );
      } else {
        toast.error("Cleanup failed");
      }
    } catch (error) {
      toast.error("Failed to run cleanup");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Trash Retention Policy</CardTitle>
          <CardDescription>
            Configure how long deleted questions are kept in the trash before
            being permanently deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="retention">Retention Period (Days)</Label>
            <Input
              type="number"
              id="retention"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              min="1"
            />
            <p className="text-sm text-muted-foreground">
              Default is 7 days. Questions older than this will be permanently
              removed.
            </p>
          </div>
          <div className="flex gap-4">
            <Button onClick={handleSave}>Save Settings</Button>
            <Button variant="destructive" onClick={handleRunCleanup}>
              Run Cleanup Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
