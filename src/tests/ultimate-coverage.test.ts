import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfile } from "@/app/[locale]/(app)/profile/actions";
import { importJSON } from "@/app/[locale]/(app)/collections/import-actions";
import { 
    toggleCollectionLock, 
    deleteCollection, 
    addQuestionToCollection,
    searchQuestions,
    restoreCollection,
    getAvailableCollections,
    getTrashedCollections
} from "@/app/[locale]/(app)/collections/actions";
import { auth } from "@/lib/auth";
import { GameManager } from "@/lib/game/GameManager";
import { registerHandlers } from "@/lib/game/socket-handlers";

const { mockDb, mockSession } = vi.hoisted(() => ({
  mockDb: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    question: { 
        findUnique: vi.fn(),
        findFirst: vi.fn(), 
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn()
    },
    collection: { 
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
    },
    questionCollection: { 
        create: vi.fn(), 
        count: vi.fn(), 
        findUnique: vi.fn(),
        findMany: vi.fn()
    },
    tag: { connectOrCreate: vi.fn() }
  },
  mockSession: { user: { id: "u1", role: "USER" } }
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("Ultimate Coverage: Actions & Admin Bypasses", () => {
    beforeEach(() => { vi.clearAllMocks(); mockSession.user.role = "USER"; });

    it("toggleCollectionLock: should allow Admin bypass", async () => {
        mockSession.user.role = "ADMIN";
        mockDb.collection.findUnique.mockResolvedValue({ id: "c1", creatorId: "u2", isLocked: true });
        mockDb.questionCollection.findMany.mockResolvedValue([]);
        const result = await toggleCollectionLock("c1");
        expect(result.success).toBe(true);
    });

    it("deleteCollection: should allow Admin bypass", async () => {
        mockSession.user.role = "ADMIN";
        mockDb.collection.findUnique.mockResolvedValue({ id: "c1", creatorId: "u2" });
        const result = await deleteCollection("c1");
        expect(result.success).toBe(true);
    });

    it("addQuestionToCollection: should force public if in multiple collections", async () => {
        mockDb.collection.findUnique.mockResolvedValue({ id: "c1", creatorId: "u1", isLocked: true });
        mockDb.question.findUnique.mockResolvedValue({ id: "q1", creatorId: "u1" });
        mockDb.questionCollection.findUnique.mockResolvedValue(null);
        mockDb.questionCollection.count.mockResolvedValue(1); 
        await addQuestionToCollection("c1", "q1");
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isLocked: false, isPermanentlyPublic: true })
        }));
    });

    it("searchQuestions: should handle collectionId filter", async () => {
        mockDb.question.findMany.mockResolvedValue([]);
        await searchQuestions("test", "c1");
        expect(mockDb.question.findMany).toHaveBeenCalled();
    });

    it("restoreCollection: should allow Admin bypass", async () => {
        mockSession.user.role = "ADMIN";
        mockDb.collection.findUnique.mockResolvedValue({ id: "c1", deletedById: "u2", isLocked: true });
        mockDb.questionCollection.findMany.mockResolvedValue([]);
        const result = await restoreCollection("c1");
        expect(result.success).toBe(true);
    });
});

describe("Ultimate Coverage: Socket Handler Branches", () => {
    let io: any, socket: any, gm: GameManager;

    beforeEach(() => {
        io = { to: vi.fn(() => ({ emit: vi.fn() })) };
        socket = { id: "s1", emit: vi.fn(), join: vi.fn(), on: vi.fn() };
        gm = new GameManager();
        registerHandlers(io, socket, gm);
    });

    it("create_room: should handle custom playerToken and name", () => {
        const createHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === "create_room")[1];
        createHandler({ playerToken: "custom-t", playerName: "Pro Player", playerAvatar: "star" });
        
        const call = (socket.emit as any).mock.calls.find((c: any) => c[0] === "room:created");
        const code = call[1].code;
        const room = gm.getRoom(code);
        expect(room?.players["custom-t"].name).toBe("Pro Player");
    });

    it("join_room: should handle string vs object code and missing data", () => {
        const joinHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === "join_room")[1];
        gm.createRoom("CODE1", "h1");
        joinHandler("CODE1");
        joinHandler({ code: "CODE1", playerToken: "p1" });
        joinHandler({ code: "CODE1", name: "Bob", avatar: "face" });
        expect(socket.emit).toHaveBeenCalledWith("room:joined", { code: "CODE1" });
    });

    it("delete_room: should succeed if host", () => {
        const deleteHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === "delete_room")[1];
        const room = gm.createRoom("DEL1", "host-t");
        room.players["host-t"] = { token: "host-t", socketId: "s1" } as any;
        deleteHandler({ code: "DEL1" });
        expect(gm.getRoom("DEL1")).toBeUndefined();
    });

    it("update_settings: should ignore if unauthorized", () => {
        const updateHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === "update_settings")[1];
        const room = gm.createRoom("CODE5", "h1");
        room.phase = "lobby";
        room.players["p2"] = { token: "p2", socketId: "s1" } as any;
        updateHandler({ code: "CODE5", settings: { simultaneousJokers: true } });
        expect(room.settings.simultaneousJokers).toBe(false);
    });

    it("use_joker: should handle catch-all risk/spy types and simultaneous guard", () => {
        const jokerHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === "use_joker")[1];
        const room = gm.createRoom("CODE3", "h1");
        room.phase = "question";
        room.settings.simultaneousJokers = true;
        room.players["h1"] = { token: "h1", socketId: "s1", connected: true, jokerRisk: true, jokerSpy: true, joker5050: true } as any;
        room.correctIndex = 0;

        jokerHandler({ code: "CODE3", type: "risk" });
        jokerHandler({ code: "CODE3", type: "spy" });
        jokerHandler({ code: "CODE3", type: "5050" });
        expect(room.players["h1"].jokerRisk).toBe(false);
        expect(room.players["h1"].jokerSpy).toBe(false);
        expect(room.players["h1"].joker5050).toBe(false);
    });
});

describe("Ultimate Coverage: Common & Profile", () => {
    it("updateProfile: should fail if user record not found", async () => {
        const formData = new FormData();
        formData.append("username", "ghost");
        formData.append("bio", "");
        formData.append("isPublic", "off");
        mockDb.user.findUnique.mockResolvedValueOnce(null);
        mockDb.user.findUnique.mockResolvedValueOnce(null);
        const result = await updateProfile(formData);
        expect(result.error).toBe("User record not found");
    });

    it("onboarding crash handled", async () => {
        const { updateUsername } = await import("@/app/[locale]/onboarding/actions");
        mockDb.user.update.mockRejectedValueOnce(new Error("Crash"));
        const formData = new FormData();
        formData.append("username", "crash");
        formData.append("bio", "b");
        formData.append("isPublic", "on");
        const res = await updateUsername(formData);
        expect(res.error).toContain("Failed: Crash");
    });

    it("importJSON: should handle empty questions or error catch", async () => {
        const originalAuth: any = vi.mocked(auth).getMockImplementation();
        vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as any);
        mockDb.user.findUnique.mockResolvedValue({ id: "u1" });
        // Valid JSON with no questions/not an array (line 78)
        expect(await importJSON("{\"x\":1}")).toEqual({ error: "Invalid JSON format" });
        // Truly invalid JSON (throws to catch block 192)
        expect(await importJSON("!!!")).toEqual({ error: "Failed to parse or import data" });
        vi.mocked(auth).mockImplementation(originalAuth!);
    });
    it("unauthorized action calls", async () => {
        const originalAuth: any = vi.mocked(auth).getMockImplementation();
        vi.mocked(auth).mockResolvedValue(null as any);
        
        expect(await getAvailableCollections()).toEqual([]);
        expect(await searchQuestions("test")).toEqual([]);
        expect(await getTrashedCollections()).toEqual([]);
        expect(await restoreCollection("c1")).toEqual({ error: "Unauthorized" });

        vi.mocked(auth).mockImplementation(originalAuth!);
    });
});

import { deleteQuestion, updateQuestion } from "@/app/[locale]/(app)/admin/actions";

describe("Ultimate Coverage: Admin and Socket Final", () => {
    beforeEach(() => { 
        vi.clearAllMocks(); 
        mockSession.user.role = "ADMIN";
        mockSession.user.id = "u1";
    });

    it("deleteQuestion: handles not found", async () => {
        mockDb.question.findUnique.mockResolvedValueOnce(null);
        const res = await deleteQuestion("ghost");
        expect(res).toEqual({ error: "Not found" });
    });

    it("updateQuestion: uses system if no user id", async () => {
        vi.mocked(auth).mockResolvedValueOnce({ user: { role: "ADMIN" } } as any);
        const formData = new FormData();
        formData.append("id", "q1");
        formData.append("text", "New Text");
        formData.append("option0", "A");
        formData.append("option1", "B");
        formData.append("correctIndex", "0");
        formData.append("collectionIds", "[]");
        formData.append("tagIds", "[]");
        
        await updateQuestion(formData);
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                editLogs: expect.objectContaining({
                    create: expect.objectContaining({ userId: "system" })
                })
            })
        }));
    });

    it("socket: skip_phase branches", async () => {
        const mIo = { to: vi.fn(() => ({ emit: vi.fn() })) };
        const mSocket = { id: "s1", emit: vi.fn(), join: vi.fn(), on: vi.fn() };
        const mGm = new GameManager();
        registerHandlers(mIo as any, mSocket as any, mGm);

        const room = mGm.createRoom("SKIP", "h1");
        room.players["h1"] = { token: "h1", socketId: mSocket.id } as any;
        (room as any).questionOrder = ["q1", "q2"];
        room.questionIndex = 0;
        
        mockDb.question.findUnique.mockResolvedValue({ id: "q1", text: "Q1", options: JSON.stringify(["A","B"]) });

        const handler = (mSocket.on as any).mock.calls.find((c: any) => c[0] === "skip_phase")[1];
        
        room.phase = "question";
        await handler({ code: "SKIP" });
        expect(room.phase).toBe("reveal");

        mockDb.question.findUnique.mockResolvedValue({ id: "q2", text: "Q2", options: JSON.stringify(["A","B"]) });
        room.phase = "reveal";
        await handler({ code: "SKIP" });
        expect(room.phase).toBe("question");

        // Null room path
        await handler({ code: "GHOST" });
    });

    it("admin/collections perfection", async () => {
        // collections/actions.ts: Unauthorized checks
        vi.mocked(auth).mockResolvedValue(null as any);
        expect(await getAvailableCollections()).toEqual([]);
        expect(await searchQuestions("t")).toEqual([]);
        expect(await getTrashedCollections()).toEqual([]);
        expect(await restoreCollection("c1")).toEqual({ error: "Unauthorized" });

        // admin/actions.ts: Missing IDs and Unauthorized
        const { updateSystemSetting, restoreQuestion } = await import("@/app/[locale]/(app)/admin/actions");
        expect(await updateSystemSetting("key", "val")).toEqual({ error: "Unauthorized" });
        expect(await restoreQuestion("q1")).toEqual({ error: "Unauthorized" });
        
        const formData = new FormData();
        vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } } as any);
        expect(await updateQuestion(formData)).toEqual({ error: "Missing ID" });
        
        mockDb.question.findUnique.mockResolvedValueOnce(null);
        expect(await deleteQuestion("")).toEqual({ error: "Not found" });

        // admin/actions.ts: Locked collection logic (lines 56-64)
        const { createQuestion } = await import("@/app/[locale]/(app)/admin/actions");
        const createForm = new FormData();
        createForm.append("text", "New Q");
        createForm.append("option0", "A");
        createForm.append("option1", "B");
        createForm.append("correctIndex", "0");
        createForm.append("collections", "locked-col");
        
        mockDb.collection.findUnique.mockResolvedValueOnce({ isLocked: true });
        mockDb.question.create.mockResolvedValue({ id: "q-locked" });
        
        await createQuestion(createForm);
        expect(mockDb.question.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isLocked: true })
        }));

        // import-actions.ts: Session check (line 35)
        vi.mocked(auth).mockResolvedValueOnce({ user: {} } as any); // No ID
        expect(await importJSON("{}")).toEqual({ error: "Unauthorized" });
    });
});
