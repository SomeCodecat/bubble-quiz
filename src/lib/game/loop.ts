import { Server } from "socket.io";
import { RoomState } from "./types";
import { GameManager } from "./GameManager";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "SYS:standard",
    },
  },
});

export function startGameLoop(room: RoomState, io: Server, gameManager: GameManager) {
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  const interval = setInterval(async () => {
    if (room.phase === "finished") {
      clearInterval(interval);
      return;
    }

    const now = Date.now();

    // Check for inactivity
    const activePlayers = Object.values(room.players).filter(
      (p: any) => p.connected
    ).length;

    // Timeout if no active players for INACTIVITY_TIMEOUT
    if (activePlayers === 0) {
      if (now - room.lastActivity > INACTIVITY_TIMEOUT) {
        logger.info(`Room ${room.code} timed out (no players)`);
        gameManager.deleteRoom(room.code);
        io.to(room.code).emit("room:deleted"); 
        clearInterval(interval);
        return;
      }
    }

    // Additional safeguard: Timeout rooms that stay in 'lobby' too long even with players
    const LOBBY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    if (room.phase === "lobby" && now - room.createdAt > LOBBY_TIMEOUT) {
        logger.info(`Room ${room.code} timed out (lobby too long)`);
        gameManager.deleteRoom(room.code);
        io.to(room.code).emit("room:deleted");
        clearInterval(interval);
        return;
    }

    if (room.paused) return; // Skip timer logic if paused

    if (room.phase === "question") {
      // Check Deadline
      if (room.qDeadlineTs && now >= room.qDeadlineTs) {
        // Time up -> Reveal
        await gameManager.revealAnswer(room);
        room.revealDeadlineTs = Date.now() + 5000; // 5s reveal
        io.to(room.code).emit("room:update", { room });
      }

      // Also check if all answered (Optional optimization)
      const allAnswered = Object.values(room.players).every(
        (p: any) => p.selectedChoice !== null
      );
      if (allAnswered && room.qDeadlineTs && now < room.qDeadlineTs) {
        // Force reveal early
        await gameManager.revealAnswer(room);
        room.revealDeadlineTs = Date.now() + 5000; // 5s reveal
        io.to(room.code).emit("room:update", { room });
      }
    } else if (room.phase === "reveal") {
      if (room.revealDeadlineTs && now >= room.revealDeadlineTs) {
        await gameManager.nextQuestion(room);
        io.to(room.code).emit("room:update", { room });
      }
    }
  }, 1000);

  return interval; // Return for testing/management
}
