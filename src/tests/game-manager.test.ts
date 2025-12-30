import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      question: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      questionCollection: {
        findMany: vi.fn(),
      },
      collection: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

import { GameManager } from '@/lib/game/GameManager';

describe('GameManager', () => {
  let gm: GameManager;

  beforeEach(() => {
    gm = new GameManager(); // Fresh instance for each test
    vi.clearAllMocks();
  });

  describe('Room Management', () => {
    it('should create and retrieve a room', () => {
      const room = gm.createRoom('ROOM1', 'host-123');
      expect(room.code).toBe('ROOM1');
      expect(room.hostToken).toBe('host-123');
      expect(gm.getRoom('ROOM1')).toEqual(room);
    });

    it('should delete a room', () => {
      gm.createRoom('ROOM1', 'host-123');
      gm.deleteRoom('ROOM1');
      expect(gm.getRoom('ROOM1')).toBeUndefined();
    });

    it('should list public rooms', () => {
      gm.createRoom('ROOM1', 'h1');
      const r2 = gm.createRoom('ROOM2', 'h2');
      r2.phase = 'finished';

      const publicRooms = gm.getPublicRooms();
      expect(publicRooms).toHaveLength(1);
      expect(publicRooms[0].code).toBe('ROOM1');
    });

    it('should handle player disconnects', () => {
      const room = gm.createRoom('ROOM1', 'h1');
      room.players['p1'] = {
        token: 'p1',
        socketId: 'sock-1',
        name: 'Player 1',
        avatar: '',
        score: 0,
        connected: true,
        lastSeen: Date.now(),
        joker5050: true,
        jokerSpy: true,
        jokerRisk: true,
        selectedChoice: null,
        usedRiskThisQ: false,
        usedSpyThisQ: false,
        used5050ThisQ: false,
      };

      const result = gm.handleDisconnect('sock-1');
      expect(result).toEqual({ roomCode: 'ROOM1', playerToken: 'p1' });
      expect(room.players['p1'].connected).toBe(false);
    });
  });

  describe('Scoring', () => {
    it('should calculate points based on question index', () => {
      expect(gm.getPointsForQuestion(0)).toBe(1); // Q1
      expect(gm.getPointsForQuestion(1)).toBe(1); // Q2
      expect(gm.getPointsForQuestion(2)).toBe(2); // Q3
      expect(gm.getPointsForQuestion(4)).toBe(3); // Q5
    });
  });

  describe('Game Flow', () => {
    it('should start a game with default strategy (pool everything)', async () => {
      const room = gm.createRoom('ROOM1', 'h1');
      mockDb.question.findMany.mockResolvedValue([
        { id: 'q1' }, { id: 'q2' }
      ]);
      mockDb.question.findUnique.mockResolvedValue({
        id: 'q1',
        text: 'Q1',
        options: JSON.stringify(['A', 'B']),
        correctIndex: 0
      });

      await gm.startGame(room, { collectionIds: [], tagIds: [] });

      expect(room.phase).toBe('question');
      expect(room.questionOrder).toHaveLength(2);
      expect(room.currentQ?.text).toBe('Q1');
      expect(room.correctIndex).toBe(0);
    });

    it('should reveal answer and update scores', async () => {
        const room = gm.createRoom('ROOM1', 'h1');
        room.questionIndex = 0;
        room.correctIndex = 1; // B is correct
        room.players['p1'] = {
            token: 'p1',
            name: 'P1',
            avatar: '',
            score: 0,
            selectedChoice: 1, // Correct
            usedRiskThisQ: false,
            // ... rest of Player props
        } as any;
        room.players['p2'] = {
            token: 'p2',
            name: 'P2',
            avatar: '',
            score: 10,
            selectedChoice: 0, // Wrong
            usedRiskThisQ: true, // Should lose points
        } as any;

        await gm.revealAnswer(room);

        expect(room.phase).toBe('reveal');
        expect(room.players['p1'].score).toBe(1); // 0 + 1
        expect(room.players['p2'].score).toBe(9); // 10 - 1
        expect(room.revealData?.picksByChoice[1]).toHaveLength(1);
    });

    it('should double points with Risk joker', async () => {
        const room = gm.createRoom('JRISK', 'h1');
        room.phase = 'question';
        room.questionIndex = 0;
        room.correctIndex = 1;
        room.players['p1'] = {
            token: 'p1',
            score: 0,
            selectedChoice: 1,
            usedRiskThisQ: true,
        } as any;

        await gm.revealAnswer(room);
        expect(room.players['p1'].score).toBe(2); // 1 * 2
    });
  });
});
