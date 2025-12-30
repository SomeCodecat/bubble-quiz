import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    systemSetting: { findUnique: vi.fn() },
    question: { deleteMany: vi.fn() },
    collection: { deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data) => ({ data, status: 200 })),
  },
}));

import { GET } from "@/app/api/cron/cleanup-trash/route";

describe("Cleanup Trash API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should cleanup based on retention days", async () => {
    mockDb.systemSetting.findUnique.mockResolvedValue({ value: "5" });
    mockDb.question.deleteMany.mockResolvedValue({ count: 10 });
    mockDb.collection.deleteMany.mockResolvedValue({ count: 2 });

    const request = { headers: { get: () => "Bearer undefined" } } as any;
    const response = (await GET(request)) as any;

    expect(response.data.success).toBe(true);
    expect(response.data.deletedQuestions).toBe(10);
    expect(response.data.deletedCollections).toBe(2);
    expect(response.data.retentionDays).toBe(5);
    expect(mockDb.question.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      })
    );
  });

  it("should default to 7 days if setting missing", async () => {
    mockDb.systemSetting.findUnique.mockResolvedValue(null);
    mockDb.question.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.collection.deleteMany.mockResolvedValue({ count: 0 });

    const request = { headers: { get: () => "" } } as any;
    const response = (await GET(request)) as any;

    expect(response.data.retentionDays).toBe(7);
  });

  it("should handle server error", async () => {
    mockDb.systemSetting.findUnique.mockRejectedValue(new Error("DB Connection Error"));
    const request = { headers: { get: () => "" } } as any;
    const response = (await GET(request)) as any;
    // status 500 would be in the real NextResponse. Re-mocking as needed.
    expect(response.data.error).toBe("Internal Server Error");
  });
});
