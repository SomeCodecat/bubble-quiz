import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerHandlers } from "@/lib/game/socket-handlers";
import { GameManager } from "@/lib/game/GameManager";

describe("Socket Handlers Coverage", () => {
  let ioMock: any;
  let socketMock: any;
  let gameManager: any;

  beforeEach(() => {
    ioMock = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
    socketMock = {
      id: "socket1",
      on: vi.fn(),
      emit: vi.fn(),
      join: vi.fn(),
    };
    gameManager = {
      getRoom: vi.fn(),
      createRoom: vi.fn(),
      deleteRoom: vi.fn(),
      revealAnswer: vi.fn(),
      nextQuestion: vi.fn(),
      startGame: vi.fn(),
      handleDisconnect: vi.fn(),
    };
  });

  function trigger(eventName: string, data: any) {
    const call = socketMock.on.mock.calls.find((c: any) => c[0] === eventName);
    if (call) {
      call[1](data);
    }
  }

  it("should handle reconnect logic in join_room", () => {
     registerHandlers(ioMock, socketMock, gameManager);
     
     const room = {
         lastActivity: 0,
         players: {
             "p1": { 
                 token: "p1", 
                 socketId: "old", 
                 connected: false,
                 name: "OldName" 
             }
         }
     };
     gameManager.getRoom.mockReturnValue(room);

     trigger("join_room", { code: "ABC", playerToken: "p1", name: "NewName" });

     const p = room.players["p1"];
     expect(p.socketId).toBe("socket1");
     expect(p.connected).toBe(true);
     expect(p.name).toBe("NewName"); // Should update
     expect(socketMock.join).toHaveBeenCalledWith("ABC");
  });

  it("should validate host token for start_game", () => {
    registerHandlers(ioMock, socketMock, gameManager);
    
    // Valid case
    const validRoom = { hostToken: "p1", players: { p1: { token: "p1", socketId: "socket1" } } };
    gameManager.getRoom.mockReturnValue(validRoom);
    trigger("start_game", { code: "ABC" });
    expect(gameManager.startGame).toHaveBeenCalled();

    // Invalid case (not host)
    gameManager.startGame.mockClear();
    socketMock.id = "socket2"; // Different socket
    trigger("start_game", { code: "ABC" });
    expect(gameManager.startGame).not.toHaveBeenCalled();
  });

  it("should validate host token for update_settings and verify phase", () => {
    registerHandlers(ioMock, socketMock, gameManager);
    
    const room = { 
        hostToken: "p1", 
        phase: "lobby", // Correct phase
        players: { p1: { token: "p1", socketId: "socket1" } },
        settings: { test: false }
    };
    gameManager.getRoom.mockReturnValue(room);
    
    trigger("update_settings", { code: "ABC", settings: { test: true } });
    expect(room.settings.test).toBe(true);
    expect(ioMock.to).toHaveBeenCalledWith("ABC");

    // Invalid phase
    room.phase = "question";
    trigger("update_settings", { code: "ABC", settings: { test: false } });
    expect(room.settings.test).toBe(true); // Should NOT change
  });

  it("should handle simultaneous joker limits", () => {
    registerHandlers(ioMock, socketMock, gameManager);
    const room = {
        phase: "question",
        settings: { simultaneousJokers: false },
        jokerUsedThisQ: true, // Already used
        players: { p1: { socketId: "socket1" } }
    };
    gameManager.getRoom.mockReturnValue(room);
    
    trigger("use_joker", { code: "ABC", type: "5050" });
    expect(socketMock.emit).toHaveBeenCalledWith("error", expect.stringContaining("already used"));
  });

  it("should handle 5050 joker logic", () => {
    registerHandlers(ioMock, socketMock, gameManager);
    const room = {
        phase: "question",
        correctIndex: 0,
        jokerUsedThisQ: false,
        settings: { simultaneousJokers: true },
        players: { 
            p1: { 
                socketId: "socket1", token: "p1", name: "P1",
                joker5050: true, used5050ThisQ: false 
            } 
        }
    };
    gameManager.getRoom.mockReturnValue(room);

    trigger("use_joker", { code: "ABC", type: "5050" });

    expect(room.players.p1.joker5050).toBe(false);
    expect(room.players.p1.used5050ThisQ).toBe(true);
    expect(socketMock.emit).toHaveBeenCalledWith("joker_effect", expect.objectContaining({ type: "5050" }));
  });

  it("should handle risk joker logic", () => {
    registerHandlers(ioMock, socketMock, gameManager);
    const room = {
        phase: "question",
        settings: { simultaneousJokers: true },
        players: { 
            p1: { 
                socketId: "socket1", token: "p1", name: "P1",
                jokerRisk: true 
            } 
        }
    };
    gameManager.getRoom.mockReturnValue(room);

    trigger("use_joker", { code: "ABC", type: "risk" });
    expect(room.players.p1.jokerRisk).toBe(false);
    expect(ioMock.emit).toHaveBeenCalledWith("joker_triggered", expect.objectContaining({ type: "risk" }));
  });

  it("should handle spy joker logic", () => {
    registerHandlers(ioMock, socketMock, gameManager);
    const room = {
        phase: "question",
        settings: { simultaneousJokers: true },
        players: { 
            p1: { 
                socketId: "socket1", token: "p1", name: "P1",
                jokerSpy: true 
            } 
        }
    };
    gameManager.getRoom.mockReturnValue(room);

    trigger("use_joker", { code: "ABC", type: "spy" });
    expect(room.players.p1.jokerSpy).toBe(false);
    expect(socketMock.emit).toHaveBeenCalledWith("joker_effect", expect.objectContaining({ type: "spy" }));
  });

  it("should handle pause/resume logic", () => {
    registerHandlers(ioMock, socketMock, gameManager);
    const now = 1000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const room = {
        hostToken: "p1",
        players: { p1: { token: "p1", socketId: "socket1" } },
        paused: false,
        phase: "question",
        qDeadlineTs: now + 5000 // 5s remaining
    };
    gameManager.getRoom.mockReturnValue(room);

    // Pause
    trigger("pause_timer", { code: "ABC" });
    expect(room.paused).toBe(true);
    expect(room.pauseRemaining).toBe(5000);
    expect(room.qDeadlineTs).toBeNull();

    // Resume
    trigger("resume_timer", { code: "ABC" });
    expect(room.paused).toBe(false);
    expect(room.qDeadlineTs).toBe(now + 5000);
  });

  it("should handle skip_phase logic", async () => {
    registerHandlers(ioMock, socketMock, gameManager);
    const room = {
        hostToken: "p1",
        players: { p1: { token: "p1", socketId: "socket1" } },
        phase: "question",
        paused: true 
    };
    gameManager.getRoom.mockReturnValue(room);

    await trigger("skip_phase", { code: "ABC" });
    
    expect(room.paused).toBe(false);
    expect(gameManager.revealAnswer).toHaveBeenCalled();
  });

});
