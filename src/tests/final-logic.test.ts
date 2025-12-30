import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameManager } from "@/lib/game/GameManager";
import { updateQuestion } from "@/app/[locale]/(app)/admin/actions";
import { addQuestionToCollection } from "@/app/[locale]/(app)/collections/actions";
import { importJSON } from "@/app/[locale]/(app)/collections/import-actions";
import { toggleLock, importSingleQuestion } from "@/app/[locale]/(app)/questions/actions";
import { startGameLoop } from "@/lib/game/loop";
import { auth } from "@/lib/auth";

const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      user: {
        findUnique: vi.fn(),
      },
      question: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      collection: {
        findUnique: vi.fn(),
        count: vi.fn(),
      },
    },
    mockSession: { user: { id: "u1", role: "ADMIN" } },
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("Final Logic Coverage: Perfection Milestone", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    it("GameManager: should return null in handleDisconnect if socket not found", () => {
        const gm = new GameManager();
        const result = gm.handleDisconnect("ghost-socket");
        expect(result).toBeNull();
    });

    it("Admin Actions: should explicitly hit line 168 (newIsLocked = false) in updateQuestion", async () => {
        const formData = new FormData();
        formData.append("id", "q1");
        formData.append("text", "Update Text");
        formData.append("option0", "A");
        formData.append("option1", "B");
        formData.append("correctIndex", "0");
        formData.append("collections", "c1");

        mockDb.question.findUnique.mockResolvedValue({ 
            id: "q1", 
            creatorId: "u1", 
            isLocked: true, 
            isPermanentlyPublic: true 
        });

        await updateQuestion(formData);
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isLocked: false })
        }));
    });

    it("Collection Actions: should hit line 353 in addQuestionToCollection", async () => {
        const collectionId = "c1";
        const questionId = "q1";
        
        mockDb.collection.findUnique.mockResolvedValue({ id: "c1", creatorId: "u1", isLocked: true });
        mockDb.question.findUnique.mockResolvedValue({ id: "q1", creatorId: "u1", isLocked: false, isPermanentlyPublic: false });
        
        (mockDb as any).questionCollection = { 
            findUnique: vi.fn().mockResolvedValue(null),
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockResolvedValue({})
        };

        await addQuestionToCollection(collectionId, questionId);
        expect(mockDb.question.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: { isLocked: true }
        }));
    });

    it("Question Actions: should return error if question not found in toggleLock", async () => {
        mockDb.question.findUnique.mockResolvedValue(null);
        const result = await toggleLock("ghost-q");
        expect(result).toEqual({ error: "Not found" });
    });

    it("Question Actions: should fail importSingleQuestion if no session", async () => {
        vi.mocked(auth).mockResolvedValueOnce(null as any);
        const result = await importSingleQuestion("{}");
        expect(result).toEqual({ error: "Unauthorized" });
    });

    it("Game Loop: should update lastActivity (line 41) in loop", async () => {
        const room = {
            code: "R1",
            phase: "question",
            players: { p1: { connected: true } },
            lastActivity: Date.now(),
        } as any;
        const io = { to: vi.fn(() => ({ emit: vi.fn() })) } as any;
        const gm = new GameManager();
        
        startGameLoop(room, io, gm);
        
        const initial = room.lastActivity;
        vi.advanceTimersByTime(2000);
        expect(room.lastActivity).toBeGreaterThan(initial);
    });
});
