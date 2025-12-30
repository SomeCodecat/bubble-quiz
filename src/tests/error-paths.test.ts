import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      question: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
      collection: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
      questionCollection: { findUnique: vi.fn(), count: vi.fn() },
      systemSetting: { findUnique: vi.fn() },
    },
    mockSession: {
      user: { id: 'user-123', role: 'USER' },
    },
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { toggleLock, deleteQuestion } from '@/app/[locale]/(app)/questions/actions';
import { createCollection, deleteCollection, addQuestionToCollection } from '@/app/[locale]/(app)/collections/actions';
import { updateUserRole, updateSystemSetting } from '@/app/[locale]/(app)/admin/actions';
import { auth } from '@/lib/auth';

describe('Error Paths & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = { id: 'user-123', role: 'USER' };
    (auth as any).mockResolvedValue(mockSession);
  });

  describe('Unauthorized (Missing Session)', () => {
    beforeEach(() => {
      (auth as any).mockResolvedValue(null);
    });

    it('should fail toggleLock when unauthorized', async () => {
      const result = await toggleLock('q1');
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should fail deleteQuestion when unauthorized', async () => {
      const result = await deleteQuestion('q1');
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should fail createCollection when unauthorized', async () => {
      const result = await createCollection(new FormData());
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should fail deleteCollection when unauthorized', async () => {
      const result = await deleteCollection('c1');
      expect(result).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Forbidden (Ownership/Role Violations)', () => {
    it('should fail deleteCollection if not owner or admin', async () => {
      mockDb.collection.findUnique.mockResolvedValue({ id: 'c1', creatorId: 'other-user' });
      const result = await deleteCollection('c1');
      expect(result).toEqual({ error: 'Forbidden' });
    });

    it('should fail addQuestionToCollection if collection is locked and user is not owner', async () => {
      mockDb.collection.findUnique.mockResolvedValue({ id: 'c1', creatorId: 'other-user', isLocked: true });
      const result = await addQuestionToCollection('c1', 'q1');
      expect(result).toEqual({ error: 'Forbidden: Collection is locked' });
    });

    it('should fail toggleLock if question is in locked collection and user is not owner', async () => {
        mockDb.question.findUnique.mockResolvedValue({ 
            id: 'q1', 
            creatorId: 'other-user',
            collections: [{ collection: { isLocked: true, creatorId: 'other-user' } }]
        });
        const result = await toggleLock('q1');
        expect(result).toEqual({ error: 'Forbidden' });
    });

    it('should fail admin actions if user is not admin', async () => {
        mockSession.user.role = 'USER';
        const resRole = await updateUserRole('u2', 'ADMIN');
        const resSet = await updateSystemSetting('key', 'val');
        expect(resRole).toEqual({ error: 'Unauthorized' });
        expect(resSet).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Not Found', () => {
    it('should fail if question does not exist', async () => {
        mockDb.question.findUnique.mockResolvedValue(null);
        const result = await toggleLock('non-existent');
        expect(result).toEqual({ error: 'Not found' });
    });

    it('should fail if collection does not exist', async () => {
        mockDb.collection.findUnique.mockResolvedValue(null);
        const result = await deleteCollection('non-existent');
        expect(result).toEqual({ error: 'Not found' });
    });
  });
});
