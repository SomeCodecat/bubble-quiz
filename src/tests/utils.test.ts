import { describe, it, expect, vi } from "vitest";
import { cn } from "@/lib/utils";
import { performBackup } from "@/lib/backup";
import fs from "fs";

describe("Utility: cn", () => {
  it("should merge class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("should handle conditional classes", () => {
    expect(cn("a", true && "b", false && "c")).toBe("a b");
  });

  it("should handle tailwind merge conflicts", () => {
    expect(cn("px-2 py-2", "p-4")).toBe("p-4");
  });

  it("should handle undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });
});

describe("Utility: backup", () => {
  it("should handle absolute path in databaseUrl", async () => {
    const config = {
      databaseUrl: "file:/tmp/test.sqlite",
      backupDir: "/tmp/backups",
      retention: 3,
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    // @ts-ignore
    vi.spyOn(fs, "copyFileSync").mockImplementation(() => {});
    vi.spyOn(fs, "readdirSync").mockReturnValue([]);
    
    await performBackup(config, logger);
    expect(fs.existsSync).toHaveBeenCalledWith("/tmp/test.sqlite");
  });
});
