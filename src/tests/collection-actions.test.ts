import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      collection: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      question: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
      },
      questionCollection: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    },
    mockSession: {
      user: {
        id: "user-123",
        role: "USER",
      },
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("nanoid", () => ({
  customAlphabet: () => () => "shortcode123",
}));

import {
  createCollection,
  toggleCollectionLock,
  addQuestionToCollection,
  deleteCollection,
  restoreCollection,
  searchQuestions,
  getAvailableCollections,
  getTrashedCollections,
  renameCollection,
  removeQuestionFromCollection,
} from "@/app/[locale]/(app)/collections/actions";
import { auth } from "@/lib/auth";

describe("Collection Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.id = "user-123";
    mockSession.user.role = "USER";
  });

  describe("createCollection", () => {
    it("should create a collection successfully", async () => {
      const formData = new FormData();
      formData.append("name", "My Collection");
      formData.append("description", "A test collection");

      mockDb.collection.create.mockResolvedValue({ id: "col-1" });

      const result = await createCollection(formData);

      expect(result).toEqual({ success: true, collectionId: "col-1" });
      expect(mockDb.collection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "My Collection",
          creator: { connect: { id: "user-123" } },
        }),
      });
    });
  });

  describe("toggleCollectionLock", () => {
    it("should lock a collection and its questions", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "user-123",
        isLocked: false,
      });
      mockDb.questionCollection.findMany.mockResolvedValue([
        { questionId: "q1" },
      ]);
      mockDb.question.findMany.mockResolvedValue([
        { id: "q1", creatorId: "user-123" },
      ]);

      const result = await toggleCollectionLock("col-1");

      expect(result).toEqual({ success: true });
      expect(mockDb.collection.update).toHaveBeenCalledWith({
        where: { id: "col-1" },
        data: { isLocked: true, ownerId: "user-123" },
      });
      // Recursive lock for questions
      expect(mockDb.question.update).toHaveBeenCalledWith({
        where: { id: "q1" },
        data: {
          isLocked: true,
          isPermanentlyPublic: false,
          ownerId: "user-123",
        },
      });
    });

    it("should unlock a collection and its questions", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "user-123",
        isLocked: true,
      });
      mockDb.questionCollection.findMany.mockResolvedValue([
        { questionId: "q1" },
      ]);

      const result = await toggleCollectionLock("col-1");

      expect(result).toEqual({ success: true });
      expect(mockDb.collection.update).toHaveBeenCalledWith({
        where: { id: "col-1" },
        data: { isLocked: false, ownerId: null },
      });
      expect(mockDb.question.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["q1"] } },
        data: { isLocked: false, ownerId: null },
      });
    });

    it("should fail toggleLock if forbidden", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "other",
      });
      const result = await toggleCollectionLock("col-1");
      expect(result).toEqual({ error: "Forbidden" });
    });
  });

  describe("addQuestionToCollection", () => {
    it("should add a question and handle public status", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        isLocked: false,
      });
      mockDb.question.findUnique.mockResolvedValue({ id: "q1" });
      mockDb.questionCollection.findUnique.mockResolvedValue(null);
      mockDb.questionCollection.count.mockResolvedValue(0); // Only in this collection

      const result = await addQuestionToCollection("col-1", "q1");

      expect(result).toEqual({ success: true });
      expect(mockDb.questionCollection.create).toHaveBeenCalled();
      expect(mockDb.question.update).toHaveBeenCalledWith({
        where: { id: "q1" },
        data: { isLocked: false },
      });
    });

    it("should make question permanently public if in multiple collections", async () => {
      mockDb.collection.findUnique.mockResolvedValue({ id: "col-1" });
      mockDb.question.findUnique.mockResolvedValue({ id: "q1" });
      mockDb.questionCollection.count.mockResolvedValue(1); // Already in another

      await addQuestionToCollection("col-1", "q1");

      expect(mockDb.question.update).toHaveBeenCalledWith({
        where: { id: "q1" },
        data: { isLocked: false, isPermanentlyPublic: true },
      });
    });

    it("should fail if question already in collection", async () => {
      mockDb.collection.findUnique.mockResolvedValue({ id: "c1" });
      mockDb.question.findUnique.mockResolvedValue({ id: "q1" });
      mockDb.questionCollection.findUnique.mockResolvedValue({
        questionId: "q1",
        collectionId: "c1",
      });

      const result = await addQuestionToCollection("c1", "q1");
      expect(result).toEqual({ error: "Question already in collection" });
    });

    it("should fail if question not found during addition", async () => {
      mockDb.collection.findUnique.mockResolvedValue({ id: "c1" });
      mockDb.question.findUnique.mockResolvedValue(null);
      const result = await addQuestionToCollection("c1", "q-none");
      expect(result).toEqual({ error: "Question not found" });
    });
  });

  describe("deleteCollection", () => {
    it("should soft delete a collection", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "user-123",
      });
      const result = await deleteCollection("col-1");
      expect(result).toEqual({ success: true });
      expect(mockDb.collection.update).toHaveBeenCalled();
    });

    it("should fail if forbidden", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "other",
      });
      const result = await deleteCollection("col-1");
      expect(result).toEqual({ error: "Forbidden" });
    });

    it("should handle deep delete with multiple questions", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "user-123",
        questions: [], // Needed for analysis logic
      });
      mockDb.questionCollection.findMany.mockResolvedValue([
        {
          question: {
            id: "q1",
            creatorId: "user-123",
            collections: [{ collectionId: "col-1" }],
          },
        },
        {
          question: {
            id: "q2",
            creatorId: "user-123",
            collections: [{ collectionId: "col-1" }, { collectionId: "other" }],
          },
        },
      ]);

      await deleteCollection("col-1", true);
      expect(mockDb.question.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["q1"] } },
        })
      );
    });
  });

  describe("renameCollection", () => {
    it("should rename if owner", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "user-123",
      });
      const result = await renameCollection("col-1", "New Name");
      expect(result).toEqual({ success: true });
    });

    it("should fail if no session in renameCollection", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);
      await expect(renameCollection("col-1", "New Name")).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("should fail if unauthorized", async () => {
      mockSession.user.id = "other";
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "user-123",
      });
      await expect(renameCollection("col-1", "New Name")).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("should fail if not found", async () => {
      mockDb.collection.findUnique.mockResolvedValue(null);
      await expect(renameCollection("col-1", "New Name")).rejects.toThrow(
        "Collection not found"
      );
    });

    it("should fail if not owner", async () => {
      mockDb.collection.findUnique.mockResolvedValue({
        id: "col-1",
        creatorId: "other",
      });
      await expect(renameCollection("col-1", "New Name")).rejects.toThrow(
        "Unauthorized"
      );
    });
  });

  describe("searchQuestions", () => {
    it("should search with collection filter", async () => {
      mockDb.question.findMany.mockResolvedValue([{ id: "q1", text: "Match" }]);
      const result = await searchQuestions("Match", "col-1");
      expect(result).toHaveLength(1);
      expect(mockDb.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({ text: { contains: "Match" } }),
              expect.objectContaining({
                collections: { some: { collectionId: "col-1" } },
              }),
            ]),
          }),
        })
      );
    });
  });

  describe("getAvailableCollections", () => {
    it("should return allowed collections", async () => {
      mockDb.collection.findMany.mockResolvedValue([
        { id: "c1", name: "Public" },
      ]);
      const result = await getAvailableCollections();
      expect(result).toHaveLength(1);
    });
  });

  describe("getTrashedCollections", () => {
    it("should return trashed collections", async () => {
      mockDb.collection.findMany.mockResolvedValue([
        { id: "c1", name: "Deleted" },
      ]);
      const result = await getTrashedCollections();
      expect(result).toHaveLength(1);
    });
  });

  it("should prevent deleting from locked collection if not owner", async () => {
    mockDb.collection.findUnique.mockResolvedValue({
      id: "c1",
      creatorId: "other",
      isLocked: true,
    });
    const result = await removeQuestionFromCollection("c1", "q1");
    expect(result).toEqual({ error: "Forbidden: Collection is locked" });
  });

  it("should prevent restoring forbidden collection", async () => {
    mockDb.collection.findUnique.mockResolvedValue({
      id: "c1",
      deletedById: "other",
      isLocked: true,
    });
    const result = await restoreCollection("c1");
    expect(result).toEqual({ error: "Forbidden" });
  });
});
