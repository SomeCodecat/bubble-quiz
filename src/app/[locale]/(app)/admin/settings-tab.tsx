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
import {
  Upload,
  Music,
  Trash2,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

const formatTime = (seconds: number) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function SettingsTab() {
  const [retentionDays, setRetentionDays] = useState("7");
  const [musicUrl, setMusicUrl] = useState("");
  const [isCycling, setIsCycling] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [musicFiles, setMusicFiles] = useState<{ name: string; url: string }[]>(
    []
  );
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(
    null
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const fetchMusicFiles = async () => {
    try {
      const res = await fetch("/api/admin/music/list");
      if (res.ok) {
        const data = await res.json();
        setMusicFiles(data);
      }
    } catch (error) {
      console.error("Failed to fetch music files", error);
    }
  };

  useEffect(() => {
    Promise.all([
      getSystemSetting("trash_retention_days"),
      getSystemSetting("background_music_url"),
      getSystemSetting("background_music_cycle"),
      fetchMusicFiles(),
    ]).then(([retention, music, cycle]) => {
      if (retention) setRetentionDays(retention);
      if (music) setMusicUrl(music);
      if (cycle !== null) setIsCycling(cycle !== "false");
      setLoading(false);
    });

    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = "";
      }
    };
  }, []);

  const toggleCycleMode = async (checked: boolean) => {
    setIsCycling(checked);
    const res = await updateSystemSetting(
      "background_music_cycle",
      String(checked)
    );
    if (!res.error) {
      toast.success(`Cycling mode ${checked ? "enabled" : "disabled"}`);
      window.dispatchEvent(
        new CustomEvent("music-settings-changed", {
          detail: { cycling: checked },
        })
      );
    } else {
      toast.error(res.error);
    }
  };

  const handlePreview = (url: string) => {
    if (previewTrack === url) {
      previewAudio?.pause();
      setPreviewTrack(null);
      return;
    }

    if (previewAudio) {
      previewAudio.pause();
    }

    const audio = new Audio(url);
    audio.volume = volume;
    audio.play();
    setPreviewAudio(audio);
    setPreviewTrack(url);

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setPreviewTrack(null);
      setCurrentTime(0);
    };
  };

  const handleSeek = (value: number[]) => {
    if (previewAudio) {
      previewAudio.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVol = value[0];
    setVolume(newVol);
    if (previewAudio) {
      previewAudio.volume = newVol;
    }
  };

  const handleSave = async () => {
    try {
      const results = await Promise.all([
        updateSystemSetting("trash_retention_days", retentionDays),
        updateSystemSetting("background_music_url", musicUrl),
      ]);

      const errors = results
        .filter((r) => r.error)
        .map((r) => r.error as string);

      if (errors.length > 0) {
        toast.error(errors.join(", "));
      } else {
        toast.success("Settings saved");
        // Trigger a custom event so the player updates immediately if needed
        window.dispatchEvent(
          new CustomEvent("music-settings-changed", {
            detail: { url: musicUrl },
          })
        );
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload-music", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setMusicUrl(data.url);
        toast.success("File uploaded successfully");
        fetchMusicFiles(); // Refresh list
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (error) {
      toast.error("Upload error");
    } finally {
      setUploading(false);
      // Clear input
      e.target.value = "";
    }
  };

  const handleDeleteMusic = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
      const res = await fetch("/api/admin/music/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("File deleted");
        fetchMusicFiles();
        // If the deleted file was the active one, clear it
        if (musicUrl.endsWith(filename)) {
          setMusicUrl(""); // Or a default
        }
      } else {
        toast.error("Delete failed");
      }
    } catch (error) {
      toast.error("Error deleting file");
    }
  };

  const handleSelectMusic = async (url: string) => {
    setMusicUrl(url);
    // Auto-save this particular setting for convenience
    const res = await updateSystemSetting("background_music_url", url);
    if (!res.error) {
      toast.success("Background music updated");
      window.dispatchEvent(
        new CustomEvent("music-settings-changed", { detail: { url } })
      );
    } else {
      toast.error(res.error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>Configure system-wide settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trash Retention */}
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="retention">Trash Retention (Days)</Label>
            <Input
              type="number"
              id="retention"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              min="1"
            />
            <p className="text-sm text-muted-foreground">
              Questions older than this in trash will be permanently removed.
            </p>
          </div>

          {/* Background Music */}
          <div className="grid w-full items-center gap-1.5 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2 font-bold text-lg">
                <Music size={20} className="text-primary" /> Background Music
                Management
              </Label>
              <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
                <Label
                  htmlFor="cycle-mode"
                  className="text-xs font-semibold cursor-pointer"
                >
                  Cycle Playlists
                </Label>
                <Switch
                  id="cycle-mode"
                  checked={isCycling}
                  onCheckedChange={toggleCycleMode}
                />
              </div>
            </div>

            <div className="space-y-4">
              {/* File Upload Area */}
              <div className="flex flex-col gap-2 p-4 bg-muted/30 rounded-lg border border-dashed">
                <Label htmlFor="music-file" className="text-sm font-medium">
                  Upload New Track
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="music-file"
                    type="file"
                    accept="audio/*"
                    className="cursor-pointer bg-background"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={uploading}
                    className="shrink-0"
                  >
                    <Upload size={16} />
                  </Button>
                </div>
                {uploading && (
                  <p className="text-xs text-primary animate-pulse">
                    Uploading file, please wait...
                  </p>
                )}
              </div>

              {/* Music Picker List */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Available Tracks (Click to Preview)
                </Label>
                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {musicFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic p-4 text-center border rounded-md">
                      No music files found. Upload some!
                    </p>
                  ) : (
                    musicFiles.map((file) => {
                      const isActive = musicUrl === file.url;
                      const isPreviewing = previewTrack === file.url;
                      return (
                        <div
                          key={file.name}
                          onClick={() => handlePreview(file.url)}
                          className={`flex flex-col p-3 rounded-md border transition-all cursor-pointer ${
                            isActive
                              ? "bg-primary/10 border-primary ring-1 ring-primary"
                              : "bg-background hover:bg-muted/50"
                          } ${isPreviewing ? "border-dashed" : ""}`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3 min-w-0">
                              {isPreviewing ? (
                                <Pause
                                  size={18}
                                  className="text-primary shrink-0 animate-pulse"
                                />
                              ) : isActive ? (
                                <CheckCircle2
                                  size={18}
                                  className="text-primary shrink-0"
                                />
                              ) : (
                                <Music
                                  size={18}
                                  className="text-muted-foreground shrink-0"
                                />
                              )}
                              <span
                                className="text-sm font-medium truncate"
                                title={file.name}
                              >
                                {file.name}
                              </span>
                            </div>
                            <div
                              className="flex items-center gap-2 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant={isActive ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleSelectMusic(file.url)}
                                disabled={isActive}
                                className="h-8"
                              >
                                {isActive ? "Active" : "Select"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive"
                                onClick={() => handleDeleteMusic(file.name)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>

                          {isPreviewing && (
                            <div
                              className="mt-3 space-y-2 px-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono w-10 text-right">
                                  {formatTime(currentTime)}
                                </span>
                                <Slider
                                  value={[currentTime]}
                                  max={duration || 100}
                                  step={0.1}
                                  onValueChange={handleSeek}
                                  className="flex-1"
                                />
                                <span className="text-xs font-mono w-10">
                                  {formatTime(duration)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Volume2
                                  size={14}
                                  className="text-muted-foreground"
                                />
                                <Slider
                                  value={[volume]}
                                  max={1}
                                  step={0.01}
                                  onValueChange={handleVolumeChange}
                                  className="w-24"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Manual URL Input (Fallback/Legacy) */}
              <div className="space-y-1.5 pt-2">
                <Label
                  htmlFor="music-url"
                  className="text-xs text-muted-foreground"
                >
                  Manual URL Override
                </Label>
                <Input
                  id="music-url"
                  type="text"
                  value={musicUrl}
                  onChange={(e) => setMusicUrl(e.target.value)}
                  placeholder="/background_music/default.mp3"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t">
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
