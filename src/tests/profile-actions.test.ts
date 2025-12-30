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

import { updateProfile } from "@/app/[locale]/(app)/profile/actions";

describe("Profile Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update profile successfully", async () => {
    const formData = new FormData();
    formData.append("username", "new_user");
    formData.append("bio", "Hello world");
    formData.append("isPublic", "on");

    mockDb.user.findUnique.mockResolvedValueOnce(null); // No existing username conflict
    mockDb.user.findUnique.mockResolvedValueOnce({ id: "u1" }); // Current user exists
    mockDb.user.update.mockResolvedValue({ id: "u1" });

    const result = await updateProfile(formData);

    expect(result).toEqual({ success: true });
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ username: "new_user", bio: "Hello world", isPublic: true }),
      })
    );
  });

  it("should fail if username is taken", async () => {
    const formData = new FormData();
    formData.append("username", "taken_user");
    formData.append("bio", "");
    formData.append("isPublic", "off");

    mockDb.user.findUnique.mockResolvedValueOnce({ id: "u2", username: "taken_user" });

    const result = await updateProfile(formData);
    expect(result.error).toBe("Username taken");
  });

  it("should fail with invalid username", async () => {
    const formData = new FormData();
    formData.append("username", "a");
    formData.append("bio", "");
    formData.append("isPublic", "off");

    const result = await updateProfile(formData);
    // Zod's min(3) error
    expect(result.error).toContain("3 characters");
  });

  it("should fail if user record not found", async () => {
    const formData = new FormData();
    formData.append("username", "ghost");
    formData.append("bio", "");
    formData.append("isPublic", "off");

    mockDb.user.findUnique.mockResolvedValueOnce(null); // No conflict check
    mockDb.user.findUnique.mockResolvedValueOnce(null); // Current user not found

    const result = await updateProfile(formData);
    expect(result.error).toBe("User record not found");
  });

  it("should return error on database fail", async () => {
    const formData = new FormData();
    formData.append("username", "error_user");
    formData.append("bio", "");
    formData.append("isPublic", "off");

    mockDb.user.findUnique.mockRejectedValue(new Error("Disk full"));

    const result = await updateProfile(formData);
    expect(result.error).toContain("Disk full");
  });
});
