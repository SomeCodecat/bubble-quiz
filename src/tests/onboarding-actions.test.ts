import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockSession } = vi.hoisted(() => ({
  mockDb: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockSession: {
    user: { id: "u1", role: "USER" },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/lib/auth";
import { updateUsername } from "@/app/[locale]/onboarding/actions";

describe("Onboarding Actions: updateUsername", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update username successfully", async () => {
    const formData = new FormData();
    formData.append("username", "new_setup");

    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.update.mockResolvedValue({ id: "u1", username: "new_setup" });

    const result = await updateUsername(formData);

    expect(result).toEqual({ success: true, username: "new_setup" });
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { username: "new_setup" },
    });
  });

  it("should fail if unauthorized", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const formData = new FormData();
    formData.append("username", "test");

    const result = await updateUsername(formData);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should fail if username too short", async () => {
    const formData = new FormData();
    formData.append("username", "ab");

    const result = await updateUsername(formData);
    expect(result.error).toContain("3 characters");
  });

  it("should fail if username already taken", async () => {
    const formData = new FormData();
    formData.append("username", "taken");

    mockDb.user.findUnique.mockResolvedValue({ id: "u2" });

    const result = await updateUsername(formData);
    expect(result).toEqual({ error: "Username already taken" });
  });

  it("should handle catch block", async () => {
    const formData = new FormData();
    formData.append("username", "error_case");

    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.update.mockRejectedValue(new Error("Crash"));

    const result = await updateUsername(formData);
    expect(result.error).toContain("Failed: Crash");
  });
});
