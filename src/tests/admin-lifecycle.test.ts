import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      question: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      collection: { findUnique: vi.fn() },
      tag: { connectOrCreate: vi.fn() },
      systemSetting: { upsert: vi.fn(), findUnique: vi.fn() },
      user: { update: vi.fn() },
    },
    mockSession: {
      user: { id: 'u1', role: 'USER' },
    },
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { 
    createQuestion, 
    updateQuestion, 
    deleteQuestion, 
    restoreQuestion, 
    updateUserRole, 
    updateSystemSetting,
    getSystemSetting
} from '@/app/[locale]/(app)/admin/actions';

describe('Admin & Question Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.question.update.mockReset();
    mockDb.question.create.mockReset();
  });

  describe('createQuestion', () => {
    it('should create a question with simple data', async () => {
      const formData = new FormData();
      formData.append('text', 'What is 2+2?');
      formData.append('option0', '3');
      formData.append('option1', '4');
      formData.append('correctIndex', '1');

      mockDb.question.create.mockResolvedValue({ id: 'q1' });

      const result = await createQuestion(formData);

      expect(result).toEqual({ success: true });
      expect(mockDb.question.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          text: 'What is 2+2?',
          correctIndex: 1,
        })
      }));
    });

    it('should create a locked question if in a locked collection', async () => {
      const formData = new FormData();
      formData.append('text', 'Locked Question');
      formData.append('option0', 'A');
      formData.append('option1', 'B');
      formData.append('correctIndex', '0');
      formData.append('collections', 'c1');

      mockDb.collection.findUnique.mockResolvedValue({ id: 'c1', isLocked: true });

      await createQuestion(formData);

      expect(mockDb.question.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          isLocked: true,
          collections: {
            create: [{ collection: { connect: { id: 'c1' } } }]
          }
        })
      }));
    });

    it('should fail with invalid data', async () => {
      const formData = new FormData();
      formData.append('text', 'ab'); // Too short (min 3)
      
      const result = await createQuestion(formData);
      expect(result).toEqual({ error: 'Invalid data' });
    });

    it('should handle database errors', async () => {
      const formData = new FormData();
      formData.append('text', 'Faulty Question');
      formData.append('option0', 'A');
      formData.append('option1', 'B');
      formData.append('correctIndex', '0');

      mockDb.question.create.mockRejectedValue(new Error('DB fail'));

      const result = await createQuestion(formData);
      expect(result).toEqual({ error: 'Database Error' });
    });
  });

  describe('updateQuestion', () => {
    it('should update a question if owner', async () => {
      const formData = new FormData();
      formData.append('id', 'q1');
      formData.append('text', 'Updated Text');
      formData.append('option0', 'Yes');
      formData.append('option1', 'No');
      formData.append('correctIndex', '0');

      mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'u1', isLocked: false });

      const result = await updateQuestion(formData);

      expect(result).toEqual({ success: true });
      expect(mockDb.question.update).toHaveBeenCalled();
    });

    it('should update a question with multiple collections', async () => {
      const formData = new FormData();
      formData.append('id', 'q1');
      formData.append('text', 'Updated Text');
      formData.append('option0', 'Yes');
      formData.append('option1', 'No');
      formData.append('correctIndex', '0');
      formData.append('collections', 'c1');
      formData.append('collections', 'c2'); // Multiple triggers Permanently Public

      mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'u1', isLocked: false });

      await updateQuestion(formData);

      expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          isPermanentlyPublic: true,
          isLocked: false
        })
      }));
    });

    it('should fail if unauthorized to update', async () => {
        const formData = new FormData();
        formData.append('id', 'q1');
        formData.append('text', 'Hack');
        formData.append('option0', 'A');
        formData.append('option1', 'B');
        formData.append('correctIndex', '0');
  
        mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'other', isLocked: true });
        mockSession.user.role = 'USER';
  
        const result = await updateQuestion(formData);
        expect(result).toEqual({ error: 'Unauthorized: Private question' });
      });

    it('should fail with invalid data in update', async () => {
        const formData = new FormData();
        formData.append('id', 'q1');
        formData.append('text', 'a'); // Too short
        const result = await updateQuestion(formData);
        expect(result).toEqual({ error: 'Invalid data' });
    });

    it('should update question with tags', async () => {
        const formData = new FormData();
        formData.append('id', 'q1');
        formData.append('text', 'Tagged Question');
        formData.append('option0', 'A');
        formData.append('option1', 'B');
        formData.append('correctIndex', '0');
        formData.append('tags', 'new-tag');

        mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'u1', isLocked: false });
        await updateQuestion(formData);
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                tags: expect.objectContaining({ create: expect.any(Array) })
            })
        }));
    });

    it('should handle permanently public question update', async () => {
        const formData = new FormData();
        formData.append('id', 'q1');
        formData.append('text', 'Public Update');
        formData.append('option0', 'A');
        formData.append('option1', 'B');
        formData.append('correctIndex', '0');

        mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'u1', isPermanentlyPublic: true, isLocked: false });
        await updateQuestion(formData);
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isLocked: false, isPermanentlyPublic: true })
        }));
    });
    it('should handle database errors in update', async () => {
        const formData = new FormData();
        formData.append('id', 'q1');
        formData.append('text', 'Faulty Update');
        formData.append('option0', 'A');
        formData.append('option1', 'B');
        formData.append('correctIndex', '0');

        mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'u1', isLocked: false });
        mockDb.question.update.mockRejectedValue(new Error('DB fail'));

        const result = await updateQuestion(formData);
        expect(result).toEqual({ error: 'Database Error' });
    });

    it('should fail update if question not found', async () => {
        const formData = new FormData();
        formData.append('id', 'none');
        formData.append('text', 'Update');
        formData.append('option0', 'A');
        formData.append('option1', 'B');
        formData.append('correctIndex', '0');

        mockDb.question.findUnique.mockResolvedValue(null);
        const result = await updateQuestion(formData);
        expect(result).toEqual({ error: 'Not found' });
    });
  });

  describe('deleteQuestion', () => {
    it('should soft delete question if owner', async () => {
      mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'u1' });
      await deleteQuestion('q1');
      expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'q1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) })
      }));
    });

    it('should fail to delete if not owner or admin', async () => {
        mockDb.question.findUnique.mockResolvedValue({ id: 'q1', creatorId: 'other' });
        mockSession.user.role = 'USER';
        const result = await deleteQuestion('q1');
        expect(result).toEqual({ error: 'Unauthorized' });
      });
  });

  describe('restoreQuestion', () => {
    it('should restore question if admin', async () => {
      mockSession.user.role = 'ADMIN';
      await restoreQuestion('q1');
      expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { deletedAt: null }
      }));
    });

    it('should fail restore if not admin', async () => {
        mockSession.user.role = 'USER';
        const result = await restoreQuestion('q1');
        expect(result).toEqual({ error: 'Unauthorized' });
      });
  });

  describe('updateUserRole', () => {
    it('should update user role if admin', async () => {
      mockSession.user.role = 'ADMIN';
      mockSession.user.id = 'admin-1';
      const result = await updateUserRole('u2', 'ADMIN');
      expect(result).toEqual({ success: true });
    });

    it('should prevent changing own role', async () => {
      mockSession.user.id = 'u1';
      mockSession.user.role = 'ADMIN';
      const result = await updateUserRole('u1', 'USER');
      expect(result).toEqual({ error: 'Cannot change your own role' });
    });
  });

  describe('updateSystemSetting', () => {
    it('should upsert system setting', async () => {
      mockSession.user.role = 'ADMIN';
      mockDb.systemSetting.upsert.mockResolvedValue({});
      const result = await updateSystemSetting('key', 'value');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getSystemSetting', () => {
    it('should return null if not admin', async () => {
      mockSession.user.role = 'USER';
      const result = await getSystemSetting('key');
      expect(result).toBeNull();
    });

    it('should return value if admin', async () => {
        mockSession.user.role = 'ADMIN';
        mockDb.systemSetting.findUnique.mockResolvedValue({ value: 'val' });
        const result = await getSystemSetting('key');
        expect(result).toBe('val');
      });
  });
});
