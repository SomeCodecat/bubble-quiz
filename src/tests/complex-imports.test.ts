import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockSession } = vi.hoisted(() => ({
  mockDb: {
    user: { findUnique: vi.fn() },
    collection: { create: vi.fn(), findFirst: vi.fn() },
    question: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    questionCollection: { create: vi.fn(), findUnique: vi.fn() },
    tag: { connectOrCreate: vi.fn() },
  },
  mockSession: {
    user: { id: "u1", role: "USER" },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("nanoid", () => ({
  customAlphabet: () => () => "shortcode123",
}));

import { importJSON } from "@/app/[locale]/(app)/collections/import-actions";

describe("Complex JSON Imports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should import a collection with questions", async () => {
    const json = JSON.stringify({
      name: "Test Coll",
      questions: [
        { text: "Q1", options: ["A", "B"], correctIndex: 0, tags: ["t1"] },
      ],
    });

    mockDb.user.findUnique.mockResolvedValue({ id: "u1" });
    mockDb.collection.create.mockResolvedValue({ id: "c1" });
    mockDb.question.findFirst.mockResolvedValue(null);
    mockDb.question.create.mockResolvedValue({ id: "q1" });

    const result = await importJSON(json);

    expect(result).toEqual({ success: true, count: 1 });
    expect(mockDb.collection.create).toHaveBeenCalled();
    expect(mockDb.questionCollection.create).toHaveBeenCalled();
  });

  it("should reuse existing active duplicate", async () => {
    const json = JSON.stringify({
      name: "Coll",
      questions: [{ text: "Q1", options: ["A", "B"], correctIndex: 0 }],
    });

    mockDb.user.findUnique.mockResolvedValue({ id: "u1" });
    mockDb.collection.create.mockResolvedValue({ id: "c1" });
    mockDb.question.findFirst.mockResolvedValue({
      id: "q-existing",
      creatorId: "u1",
      isLocked: false,
    });

    const result = await importJSON(json);
    expect(result.success).toBe(true);
    expect(mockDb.question.create).not.toHaveBeenCalled();
    expect(mockDb.questionCollection.create).toHaveBeenCalled();
  });

  it("should duplicate instead of link if someone else is owner of private question", async () => {
    const json = JSON.stringify({
      name: "Coll",
      questions: [{ text: "Q1", options: ["A", "B"], correctIndex: 0 }],
    });

    mockDb.user.findUnique.mockResolvedValue({ id: "u1" });
    mockDb.collection.create.mockResolvedValue({ id: "c1" });
    // Same question text+options, but owned by u2 and locked
    mockDb.question.findFirst.mockResolvedValue({
      id: "q-private",
      creatorId: "u2",
      isLocked: true,
    });
    // Mock create to return a new ID
    mockDb.question.create.mockResolvedValue({ id: "q-mine" });

    await importJSON(json);

    expect(mockDb.question.create).toHaveBeenCalled(); // Should duplicate for me
    expect(mockDb.questionCollection.create).toHaveBeenCalled();
  });

  it("should import unwrapped array of questions", async () => {
    const json = JSON.stringify([
      { text: "Q1", options: ["A", "B"], correctIndex: 0 },
    ]);

    mockDb.user.findUnique.mockResolvedValue({ id: "u1" });
    mockDb.collection.create.mockResolvedValue({ id: "c1" });
    mockDb.question.findFirst.mockResolvedValue(null);
    mockDb.question.create.mockResolvedValue({ id: "q1" });

    const result = await importJSON(json);
    if (result.error) console.error("Import Error:", result.error);
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(mockDb.collection.create).toHaveBeenCalled();
  });

  it("should fail if user record missing in DB", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    const result = await importJSON("[]");
    expect(result.error).toContain("User record not found");
  });

  it("should handle catch block on error", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "u1" });
    // Force error by passing invalid JSON that JSON.parse won't catch?
    // No, JSON.parse will catch it. Let's mock collection.create to throw.
    mockDb.collection.create.mockRejectedValue(new Error("DB Crash"));

    const result = await importJSON('{"questions":[]}');
    expect(result.error).toBe("Failed to parse or import data");
  });

  it("should handle markdown code blocks and extra text", async () => {
    const jsonWithGarbage =
      "Some text before\n```json\n" +
      JSON.stringify({
        questions: [{ text: "Q", options: ["A", "B"], correctIndex: 0 }],
      }) +
      "\n```\nAfter text";

    mockDb.user.findUnique.mockResolvedValue({ id: "u1" });
    mockDb.collection.create.mockResolvedValue({ id: "c1" });
    mockDb.question.create.mockResolvedValue({ id: "q1" });

    const result = await importJSON(jsonWithGarbage);
    expect(result.success).toBe(true);
  });
});
