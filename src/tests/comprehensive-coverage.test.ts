import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameManager } from "@/lib/game/GameManager";
import { performBackup } from "@/lib/backup";
import { updateQuestion, createQuestion } from "@/app/[locale]/(app)/admin/actions";
import { renameCollection } from "@/app/[locale]/(app)/collections/actions";
import { auth } from "@/lib/auth";

const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      user: {
        update: vi.fn(),
      },
      question: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      questionCollection: {
        findMany: vi.fn(),
      },
      collection: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      systemSetting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    },
    mockSession: { user: { id: "u1", role: "ADMIN" } },
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));

// Mock fs/path for backup tests
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));
import fs from "fs";

// Mock cache
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("Comprehensive Coverage: GameManager", () => {
    let gm: GameManager;
    
    beforeEach(() => {
        gm = new GameManager();
        vi.clearAllMocks();
    });

    it("should handle consistent strategy with remainder filling", async () => {
        const room = gm.createRoom("R1", "h1");
        room.players["p1"] = { token: "t1", socketId: "s1", name: "Alice", avatar: "A1" } as any;
        const config = {
            collectionIds: ["c1", "c2"],
            ratioStrategy: "consistent",
             totalQuestions: 4
        };
        
        mockDb.questionCollection.findMany.mockResolvedValue([
            { questionId: "q1", collectionId: "c1" },
            { questionId: "q2", collectionId: "c1" },
            { questionId: "q3", collectionId: "c2" },
            { questionId: "q4", collectionId: "c2" },
        ]);
        mockDb.question.findMany.mockResolvedValue([
            { id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }
        ]);

        await gm.startGame(room, config);
        expect(room.questionOrder).toHaveLength(4);
    });

    it("should handle custom strategy with remainder filling", async () => {
        const room = gm.createRoom("R2", "h1");
        const config = {
            collectionIds: ["c1"],
            ratioStrategy: "custom",
            customRatios: { "c1": 1 },
            totalQuestions: 2
        };
        
        mockDb.questionCollection.findMany.mockResolvedValue([
            { questionId: "q1", collectionId: "c1" },
            { questionId: "extra", collectionId: "c1" }
        ]);
        mockDb.question.findMany.mockResolvedValue([
            { id: "q1" }, { id: "extra" }
        ]);

        await gm.startGame(room, config);
        expect(room.questionOrder).toHaveLength(2);
    });

    it("should handle startGame with tags", async () => {
        const room = gm.createRoom("R6", "h1");
        const config = { tagIds: ["t1"], totalQuestions: 1 };
        
        (mockDb as any).questionTag = { findMany: vi.fn().mockResolvedValue([{ questionId: "q_tag" }]) };
        mockDb.question.findMany.mockResolvedValue([{ id: "q_tag" }]);
        
        await gm.startGame(room, config);
        expect(room.questionOrder).toContain("q_tag");
    });

    it("should reach finished phase in nextQuestion", async () => {
        const room = gm.createRoom("R4", "h1");
        room.players["p1"] = { token: "t1", socketId: "s1", name: "Alice", avatar: "A1" } as any;
        room.questionOrder = ["q1"] as any;
        room.questionIndex = 0; // next call will make it 1
        await gm.nextQuestion(room);
        expect(room.phase).toBe("finished");
    });

    it("should handle revealAnswer with out-of-bounds choice", async () => {
        const room = gm.createRoom("R5", "h1");
        room.correctIndex = 1;
        room.questionIndex = 0;
        room.questionOrder = ["q1"] as any;
        room.players["p1"] = { token: "t1", socketId: "s1", name: "Alice", avatar: "A1", selectedChoice: 4 } as any;
        
        await gm.revealAnswer(room);
        expect(room.revealData?.picksByChoice[4]).toHaveLength(1);
    });

    it("should return points for high question indices", () => {
        expect(gm.getPointsForQuestion(10)).toBe(6);
    });
});

describe("Comprehensive Coverage: Admin Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSession.user.role = "ADMIN";
    });

    it("should update question with single collection and inherit locked status", async () => {
        const formData = new FormData();
        formData.append("id", "q1");
        formData.append("text", "Update Text");
        formData.append("option0", "A");
        formData.append("option1", "B");
        formData.append("correctIndex", "0");
        formData.append("collections", "c1");

        mockDb.question.findUnique.mockResolvedValue({ id: "q1", creatorId: "u1", isLocked: false, isPermanentlyPublic: false });
        mockDb.collection.findUnique.mockResolvedValue({ id: "c1", isLocked: true });

        await updateQuestion(formData);
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isLocked: true })
        }));
    });

    it("should handle update with 0 collections and remove lock if permanently public", async () => {
        const formData = new FormData();
        formData.append("id", "q1");
        formData.append("text", "Update Text");
        formData.append("option0", "A");
        formData.append("option1", "B");
        formData.append("correctIndex", "0");

        mockDb.question.findUnique.mockResolvedValue({ id: "q1", creatorId: "u1", isLocked: true, isPermanentlyPublic: true });
        
        await updateQuestion(formData);
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isLocked: false })
        }));
    });

    it("should set isLocked=false in updateQuestion if permanently public and 1 collection", async () => {
        const formData = new FormData();
        formData.append("id", "q1");
        formData.append("text", "Update Text");
        formData.append("option0", "A");
        formData.append("option1", "B");
        formData.append("correctIndex", "0");
        formData.append("collections", "c1");

        mockDb.question.findUnique.mockResolvedValue({ id: "q1", creatorId: "u1", isLocked: true, isPermanentlyPublic: true });
        
        await updateQuestion(formData);
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isLocked: false })
        }));
    });

    it("should fail updateQuestion if no session", async () => {
        const formData = new FormData();
        formData.append("id", "q1");
        vi.mocked(auth).mockResolvedValueOnce(null as any);
        const result = await updateQuestion(formData);
        expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should fail createQuestion if no session", async () => {
        const formData = new FormData();
        vi.mocked(auth).mockResolvedValueOnce(null as any);
        const result = await createQuestion(formData as any);
        expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should set isPermanentlyPublic if many collections", async () => {
        const formData = new FormData();
        formData.append("text", "Multi Col");
        formData.append("option0", "A");
        formData.append("option1", "B");
        formData.append("correctIndex", "0");
        formData.append("collections", "c1");
        formData.append("collections", "c2");

        await createQuestion(formData);
        expect(mockDb.question.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isPermanentlyPublic: true, isLocked: false })
        }));
    });
});

describe("Comprehensive Coverage: Backup Utility", () => {
    it("should fail if database URL is not file:", async () => {
        const logger = { error: vi.fn(), info: vi.fn() };
        await performBackup({ databaseUrl: "postgres://...", backupDir: "./", retention: 1 }, logger);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Only SQLite"));
    });

    it("should create backup directory if missing", async () => {
        (fs.existsSync as any).mockReturnValueOnce(true); // db exists
        (fs.existsSync as any).mockReturnValueOnce(false); // backupDir missing
        (fs.readdirSync as any).mockReturnValue([]);
        
        await performBackup({ databaseUrl: "file:./dev.db", backupDir: "./backups", retention: 1 });
        expect(fs.mkdirSync).toHaveBeenCalledWith("./backups", { recursive: true });
    });

    it("should handle error during copy", async () => {
        const logger = { error: vi.fn(), info: vi.fn() };
        (fs.existsSync as any).mockReturnValue(true);
        (fs.copyFileSync as any).mockImplementation(() => { throw new Error("Disk Full"); });
        
        await performBackup({ databaseUrl: "file:./dev.db", backupDir: "./backups", retention: 1 }, logger);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Backup failed with error:"), expect.any(Error));
    });
});
