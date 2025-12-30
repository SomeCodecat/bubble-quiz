import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameManager } from '@/lib/game/GameManager';

const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      question: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      collection: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      questionCollection: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      systemSetting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    },
    mockSession: {
      user: {
        id: 'user-123',
        role: 'USER',
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { deleteCollection, searchQuestions, getAvailableCollections, restoreCollection, removeQuestionFromCollection } from '@/app/[locale]/(app)/collections/actions';
import { restoreQuestion, getSystemSetting } from '@/app/[locale]/(app)/admin/actions';

describe('Advanced Strategies & Operations (Phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GameManager Pool Strategies', () => {
    const gameManager = new GameManager();

    it('should handle consistent ratio strategy', async () => {
        const room = gameManager.createRoom('CONST', 'host');
        mockDb.questionCollection.findMany.mockResolvedValue([
            { collectionId: 'c1', questionId: 'q1' },
            { collectionId: 'c1', questionId: 'q2' },
            { collectionId: 'c2', questionId: 'q3' },
            { collectionId: 'c2', questionId: 'q4' },
        ]);
        mockDb.question.findMany.mockResolvedValue([
            { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }
        ]);

        await gameManager.startGame(room, {
            collectionIds: ['c1', 'c2'],
            questionCount: 4,
            ratioStrategy: 'consistent'
        });

        expect(room.questionOrder).toHaveLength(4);
    });

    it('should handle custom ratio strategy', async () => {
        const room = gameManager.createRoom('CUSTOM', 'host');
        mockDb.questionCollection.findMany.mockResolvedValue([
            { collectionId: 'c1', questionId: 'q1' },
            { collectionId: 'c1', questionId: 'q2' },
            { collectionId: 'c1', questionId: 'q3' },
            { collectionId: 'c2', questionId: 'q4' },
        ]);
        mockDb.question.findMany.mockResolvedValue([
            { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }
        ]);

        await gameManager.startGame(room, {
            collectionIds: ['c1', 'c2'],
            questionCount: 4,
            ratioStrategy: 'custom',
            customRatios: { 'c1': 3, 'c2': 1 }
        });

        expect(room.questionOrder).toHaveLength(4);
    });
  });

  describe('Collection Deep Deletion', () => {
    it('should only delete questions owned by user and not in other collections', async () => {
      const mockQuestions = [
        { 
          question: { 
            id: 'q-owned-solo', 
            creatorId: 'user-123', 
            collections: [{ collectionId: 'c1' }] 
          } 
        },
        { 
          question: { 
            id: 'q-owned-shared', 
            creatorId: 'user-123', 
            collections: [{ collectionId: 'c1' }, { collectionId: 'c2' }] 
          } 
        },
        { 
          question: { 
            id: 'q-not-owned', 
            creatorId: 'other-user', 
            collections: [{ collectionId: 'c1' }] 
          } 
        }
      ];

      mockDb.collection.findUnique.mockResolvedValue({ 
        id: 'c1', 
        creatorId: 'user-123',
        questions: mockQuestions
      });

      mockDb.questionCollection.findMany.mockResolvedValue(mockQuestions);

      await deleteCollection('c1', true);

      expect(mockDb.question.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['q-owned-solo'] } },
        data: expect.objectContaining({
          deletedById: 'user-123'
        })
      });
    });
  });

  describe('Search & Discovery', () => {
    it('should filter search results by collection', async () => {
      mockDb.question.findMany.mockResolvedValue([]);
      await searchQuestions('test', 'coll-123');
      
      expect(mockDb.question.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              collections: { some: { collectionId: 'coll-123' } }
            })
          ])
        })
      }));
    });

    it('should only show accessible collections', async () => {
      mockDb.collection.findMany.mockResolvedValue([]);
      await getAvailableCollections();
      
      expect(mockDb.collection.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          OR: [{ creatorId: 'user-123' }, { isLocked: false }]
        }
      }));
    });
  });

  describe('Collection Restoration', () => {
    it('should restore collection and its public/owned deleted questions', async () => {
        mockDb.collection.findUnique.mockResolvedValue({ id: 'c1', deletedById: 'user-123' });
        mockDb.questionCollection.findMany.mockResolvedValue([{ questionId: 'q1' }]);

        await restoreCollection('c1');

        expect(mockDb.collection.update).toHaveBeenCalled();
        expect(mockDb.question.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                id: { in: ['q1'] },
                deletedAt: { not: null }
            })
        }));
    });
  });

  describe('Question Member Management', () => {
    it('should remove a question from a collection', async () => {
      mockDb.collection.findUnique.mockResolvedValue({ id: 'c1', creatorId: 'user-123' });
      
      await removeQuestionFromCollection('c1', 'q1');

      expect(mockDb.questionCollection.delete).toHaveBeenCalledWith({
        where: {
          questionId_collectionId: {
            questionId: 'q1',
            collectionId: 'c1'
          }
        }
      });
    });
  });

  describe('Admin Operations', () => {
    it('should restore a question if admin', async () => {
        mockSession.user.role = 'ADMIN';
        mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'user-456' });

        await restoreQuestion('q1');

        expect(mockDb.question.update).toHaveBeenCalledWith({
            where: { id: 'q1' },
            data: expect.objectContaining({ deletedAt: null })
        });
    });

    it('should get a system setting if admin', async () => {
        mockSession.user.role = 'ADMIN';
        mockDb.systemSetting.findUnique.mockResolvedValue({ key: 'test', value: 'val' });

        const val = await getSystemSetting('test');
        expect(val).toBe('val');
    });
  });
});
