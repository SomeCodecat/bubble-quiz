import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(() => Promise.resolve("hashed_password")),
  },
}));

import { registerUser } from "@/app/actions/auth";

describe("Auth Actions: registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register a new user successfully", async () => {
    const formData = new FormData();
    formData.append("email", "test@example.com");
    formData.append("password", "password123");
    formData.append("username", "testuser");

    mockDb.user.findFirst.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({ id: "u1" });

    const result = await registerUser(formData);

    expect(result).toEqual({ success: true });
    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "test@example.com",
          username: "testuser",
          password: "hashed_password",
        }),
      })
    );
  });

  it("should fail if email/username already exists", async () => {
    const formData = new FormData();
    formData.append("email", "taken@example.com");
    formData.append("password", "password123");
    formData.append("username", "takenuser");

    mockDb.user.findFirst.mockResolvedValue({ id: "u2" });

    const result = await registerUser(formData);

    expect(result).toEqual({ error: "Email or Username already exists" });
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it("should fail validation with invalid email", async () => {
    const formData = new FormData();
    formData.append("email", "invalid-email");
    formData.append("password", "password123");
    formData.append("username", "user");

    const result = await registerUser(formData);

    expect(result).toEqual({ error: "Invalid input data" });
  });

  it("should fail validation with too short password", async () => {
    const formData = new FormData();
    formData.append("email", "test@example.com");
    formData.append("password", "123");
    formData.append("username", "user");

    const result = await registerUser(formData);

    expect(result).toEqual({ error: "Invalid input data" });
  });

  it("should return error on database fail", async () => {
    const formData = new FormData();
    formData.append("email", "test@example.com");
    formData.append("password", "password123");
    formData.append("username", "testuser");

    mockDb.user.findFirst.mockRejectedValue(new Error("DB Connection Error"));

    const result = await registerUser(formData);

    expect(result).toEqual({ error: "Registration failed" });
  });
});
