import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      question: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      collection: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
      },
      systemSetting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      user: {
        update: vi.fn(),
      }
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

import { toggleLock, getTrashedQuestions } from '@/app/[locale]/(app)/questions/actions';
import { updateUserRole, updateSystemSetting } from '@/app/[locale]/(app)/admin/actions';
import { getTrashedCollections } from '@/app/[locale]/(app)/collections/actions';

describe('Advanced Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.role = 'USER';
    mockSession.user.id = 'user-123';
  });

  describe('toggleLock (Question)', () => {
    it('should unlock and make permanently public if in locked collection', async () => {
      mockDb.question.findUnique.mockResolvedValue({
        id: 'q1',
        creatorId: 'user-123',
        isLocked: true,
      });
      mockDb.collection.count.mockResolvedValue(1); // In a locked collection

      await toggleLock('q1');

      expect(mockDb.question.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: expect.objectContaining({
          isLocked: false,
          isPermanentlyPublic: true,
        }),
      });
    });

    it('should prevent user from locking permanently public question', async () => {
      mockDb.question.findUnique.mockResolvedValue({
        id: 'q1',
        creatorId: 'user-123',
        isLocked: false,
        isPermanentlyPublic: true,
      });

      const result = await toggleLock('q1');

      expect(result).toEqual({ error: 'Cannot lock a permanently public question' });
      expect(mockDb.question.update).not.toHaveBeenCalled();
    });

    it('should allow admin to override permanently public status', async () => {
      mockSession.user.role = 'ADMIN';
      mockDb.question.findUnique.mockResolvedValue({
        id: 'q1',
        creatorId: 'user-123',
        isLocked: false,
        isPermanentlyPublic: true,
      });

      await toggleLock('q1');

      expect(mockDb.question.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: expect.objectContaining({
          isLocked: true,
          isPermanentlyPublic: false,
        }),
      });
    });
  });

  describe('Admin Actions', () => {
    it('should update user role if admin', async () => {
      mockSession.user.role = 'ADMIN';
      const result = await updateUserRole('user-456', 'ADMIN');
      expect(result).toEqual({ success: true });
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        data: { role: 'ADMIN' },
      });
    });

    it('should prevent changing own role', async () => {
        mockSession.user.role = 'ADMIN';
        const result = await updateUserRole('user-123', 'USER');
        expect(result).toEqual({ error: 'Cannot change your own role' });
        expect(mockDb.user.update).not.toHaveBeenCalled();
    });

    it('should update system setting', async () => {
        mockSession.user.role = 'ADMIN';
        await updateSystemSetting('test-key', 'test-value');
        expect(mockDb.systemSetting.upsert).toHaveBeenCalledWith({
            where: { key: 'test-key' },
            update: { value: 'test-value' },
            create: { key: 'test-key', value: 'test-value' },
        });
    });
  });

  describe('Trash Visibility', () => {
    it('should show all trashed questions to admin', async () => {
      mockSession.user.role = 'ADMIN';
      mockDb.question.findMany.mockResolvedValue([
        { id: 'q1', options: '[]' },
        { id: 'q2', options: '[]' }
      ]);

      const result = await getTrashedQuestions();
      expect(result).toHaveLength(2);
      expect(mockDb.question.findMany).toHaveBeenCalledWith({
        where: { deletedAt: { not: null } },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('should restrict trashed collections for regular users', async () => {
        mockDb.collection.findMany.mockResolvedValue([]);
        await getTrashedCollections();
        expect(mockDb.collection.findMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                deletedAt: { not: null },
                OR: [
                    { isLocked: false },
                    { deletedById: 'user-123' }
                ]
            }),
            include: expect.any(Object),
            orderBy: expect.any(Object),
        });
    });
  });
});
