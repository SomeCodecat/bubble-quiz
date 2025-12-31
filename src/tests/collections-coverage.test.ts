import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCollection,
  toggleCollectionLock,
  deleteCollection,
  getCollectionDeletionAnalysis,
  addQuestionToCollection,
  removeQuestionFromCollection,
  searchQuestions,
  restoreCollection,
} from "@/app/[locale]/(app)/collections/actions";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

vi.mock("@/lib/db", () => ({
  db: {
    collection: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    questionCollection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    question: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Collections Coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCollection", () => {
    it("should fail if name is missing", async () => {
      (auth as any).mockResolvedValue({ user: { id: "u1" } });
      const formData = new FormData();
      // No name
      const res = await createCollection(formData);
      expect(res.error).toBe("Name is required");
    });
  });

  describe("toggleCollectionLock", () => {
    it("should return Unauthorized if no session", async () => {
      (auth as any).mockResolvedValue(null);
      const res = await toggleCollectionLock("c1");
      expect(res.error).toBe("Unauthorized");
    });

    it("should return Not found if collection does not exist", async () => {
      (auth as any).mockResolvedValue({ user: { id: "u1" } });
      (db.collection.findUnique as any).mockResolvedValue(null);
      const res = await toggleCollectionLock("c1");
      expect(res.error).toBe("Not found");
    });
    
    it("should prevent non-admin/non-owner from toggling", async () => {
       (auth as any).mockResolvedValue({ user: { id: "u2", role: "USER" } });
       (db.collection.findUnique as any).mockResolvedValue({ id: "c1", creatorId: "u1" });
       const res = await toggleCollectionLock("c1");
       expect(res.error).toBe("Forbidden");
    });

    it("should handle locking logic: lock non-public questions for user", async () => {
      (auth as any).mockResolvedValue({ user: { id: "u1", role: "USER" } });
      (db.collection.findUnique as any).mockResolvedValue({ 
        id: "c1", 
        creatorId: "u1", 
        isLocked: false // Toggling to true/locked
      });
      (db.questionCollection.findMany as any).mockResolvedValue([{ questionId: "q1" }]);
      (db.question.findMany as any).mockResolvedValue([{ id: "q1", creatorId: "u1" }]);

      await toggleCollectionLock("c1");
      
      // Should define correct where clause excluding permanently public
      expect(db.question.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: {
             id: { in: ["q1"] },
             isPermanentlyPublic: false
          }
      }));
    });

    it("should handle locking logic: lock ALL questions for admin", async () => {
        (auth as any).mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
        (db.collection.findUnique as any).mockResolvedValue({ 
          id: "c1", 
          creatorId: "u1", 
          isLocked: false
        });
        (db.questionCollection.findMany as any).mockResolvedValue([{ questionId: "q1" }]);
        (db.question.findMany as any).mockResolvedValue([{ id: "q1", creatorId: "u1" }]);
  
        await toggleCollectionLock("c1");
        
        // Should NOT filter by isPermanentlyPublic
        expect(db.question.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
               id: { in: ["q1"] }
            }
        }));
      });
    
      it("should handle unlocking logic", async () => {
        (auth as any).mockResolvedValue({ user: { id: "u1" } });
        (db.collection.findUnique as any).mockResolvedValue({ 
          id: "c1", creatorId: "u1", isLocked: true // Toggling to false/unlock
        });
        (db.questionCollection.findMany as any).mockResolvedValue([{ questionId: "q1" }]);
        
        await toggleCollectionLock("c1");
        
        expect(db.question.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["q1"] } },
            data: { isLocked: false, ownerId: null }
        });
      });
  });

  describe("deleteCollection", () => {
      it("should perform deep delete correctly", async () => {
         (auth as any).mockResolvedValue({ user: { id: "u1" } });
         // Mock findUnique needs questions array for getCollectionDeletionAnalysis
         (db.collection.findUnique as any).mockResolvedValue({ 
             id: "c1", 
             creatorId: "u1",
             questions: [] 
         });
         
         // Mock collection analysis logic/findMany
         // The function re-fetches questionCollection with specific includes
         (db.questionCollection.findMany as any).mockResolvedValue([
             {
                 question: {
                     id: "q1",
                     creatorId: "u1",
                     collections: [ { collectionId: "c1"} ] // Only this one
                 }
             },
             {
                question: {
                    id: "q2",
                    creatorId: "u1",
                    collections: [ { collectionId: "c1"}, { collectionId: "c2"} ] // Other usage
                }
            }
         ]);

         await deleteCollection("c1", true);

         // Should only delete q1
         expect(db.question.updateMany).toHaveBeenCalledWith({
             where: { id: { in: ["q1"] } },
             data: expect.objectContaining({ deletedAt: expect.any(Date) })
         });
      });
  });

  describe("addQuestionToCollection", () => {
      it("should fail validation checks", async () => {
          (auth as any).mockResolvedValue({ user: { id: "u1" } });
          
          // Case: Collection not found
          (db.collection.findUnique as any).mockResolvedValueOnce(null);
          expect((await addQuestionToCollection("c1", "q1")).error).toBe("Collection not found");

          // Case: Locked and forbidden
          (auth as any).mockResolvedValue({ user: { id: "u2", role: "USER" } });
          (db.collection.findUnique as any).mockResolvedValueOnce({ id: "c1", creatorId: "u1", isLocked: true });
          expect((await addQuestionToCollection("c1", "q1")).error).toContain("Forbidden");
          
          // Case: Question not found
          (auth as any).mockResolvedValue({ user: { id: "u1" } });
          (db.collection.findUnique as any).mockResolvedValueOnce({ id: "c1", creatorId: "u1" });
          (db.question.findUnique as any).mockResolvedValueOnce(null);
          expect((await addQuestionToCollection("c1", "q1")).error).toBe("Question not found");

           // Case: Already exists
           (db.question.findUnique as any).mockResolvedValueOnce({ id: "q1" });
           (db.questionCollection.findUnique as any).mockResolvedValueOnce({ });
           expect((await addQuestionToCollection("c1", "q1")).error).toContain("already in collection");
      });

      it("should set permanently public if multiple collections", async () => {
        (auth as any).mockResolvedValue({ user: { id: "u1" } });
        (db.collection.findUnique as any).mockResolvedValue({ id: "c1", creatorId: "u1" });
        (db.question.findUnique as any).mockResolvedValue({ id: "q1" });
        (db.questionCollection.findUnique as any).mockResolvedValue(null);
        
        // Count > 0 means other collections exist
        (db.questionCollection.count as any).mockResolvedValue(2); 

        await addQuestionToCollection("c1", "q1");
        
        expect(db.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: { isLocked: false, isPermanentlyPublic: true }
        }));
      });

      it("should lock question if collection is locked", async () => {
        (auth as any).mockResolvedValue({ user: { id: "u1" } });
        (db.collection.findUnique as any).mockResolvedValue({ id: "c1", creatorId: "u1", isLocked: true });
        (db.question.findUnique as any).mockResolvedValue({ id: "q1" });
        (db.questionCollection.findUnique as any).mockResolvedValue(null);
        (db.questionCollection.count as any).mockResolvedValue(0); 

        await addQuestionToCollection("c1", "q1");
        
        expect(db.question.updateMany).toHaveBeenCalled();
      });
  });

  describe("removeQuestionFromCollection", () => {
     it("should return Unauthorized", async () => {
        (auth as any).mockResolvedValue(null);
        const res = await removeQuestionFromCollection("c1", "q1");
        expect(res.error).toBe("Unauthorized");
     });
     it("should return not found", async () => {
        (auth as any).mockResolvedValue({ user: { id: "u1" } });
        (db.collection.findUnique as any).mockResolvedValue(null);
        const res = await removeQuestionFromCollection("c1", "q1");
        expect(res.error).toBe("Collection not found");
     });
     it("should forbid locked collection modification for non-owner", async () => {
        (auth as any).mockResolvedValue({ user: { id: "u2" } });
        (db.collection.findUnique as any).mockResolvedValue({ id: "c1", creatorId: "u1", isLocked: true });
        const res = await removeQuestionFromCollection("c1", "q1");
        expect(res.error).toContain("Forbidden");
     });
  });

  describe("searchQuestions", () => {
      it("should filter by collectionId if provided", async () => {
          (auth as any).mockResolvedValue({ user: { id: "u1" } });
          await searchQuestions("test", "c1");
          expect(db.question.findMany).toHaveBeenCalledWith(expect.objectContaining({
              where: expect.objectContaining({
                  AND: expect.arrayContaining([
                      expect.objectContaining({
                          collections: { some: { collectionId: "c1" } }
                      })
                  ])
              })
          }));
      });
  });

  describe("restoreCollection", () => {
      it("should validate permissions", async () => {
        (auth as any).mockResolvedValue({ user: { id: "u2" } });
        (db.collection.findUnique as any).mockResolvedValue({ 
            id: "c1", 
            deletedById: "u1", // Deleted by someone else
            isLocked: true // And locked? Logic check
        });
        const res = await restoreCollection("c1");
        expect(res.error).toBe("Forbidden");
      });

      it("should not crash on not found", async () => {
        (auth as any).mockResolvedValue({ user: { id: "u1" } });
        (db.collection.findUnique as any).mockResolvedValue(null);
        const res = await restoreCollection("c1");
        expect(res.error).toBe("Not found");
      });
  });

});
