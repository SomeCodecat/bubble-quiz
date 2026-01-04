"use server";

import { db } from "@/lib/db";
import { gameManager } from "@/lib/game/GameManager";

export async function getLobbyStats() {
  const [userCount, questionCount, collectionCount] = await Promise.all([
    db.user.count(),
    db.question.count({ where: { deletedAt: null } }),
    db.collection.count({ where: { deletedAt: null } }),
  ]);

  const { onlineUsers, activeRooms } = gameManager.getGlobalStats();

  return {
    users: userCount,
    questions: questionCount,
    collections: collectionCount,
    online: onlineUsers,
    activeRooms: activeRooms,
  };
}
