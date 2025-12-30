import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are initialized before usage
const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      question: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      collection: {
        findUnique: vi.fn(),
        count: vi.fn(),
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
    }
  }
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

// Imports must be after mocks
import { createQuestion, updateQuestion } from '@/app/[locale]/(app)/admin/actions';
import { deleteQuestion, restoreQuestion, importSingleQuestion, getTrashedQuestions, toggleLock } from '@/app/[locale]/(app)/questions/actions';

describe('Question Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createQuestion', () => {
    it('should create a question successfully', async () => {
      const formData = new FormData();
      formData.append('text', 'What is 2+2?');
      formData.append('option0', '3');
      formData.append('option1', '4');
      formData.append('option2', '5');
      formData.append('option3', '6');
      formData.append('correctIndex', '1');
      formData.append('tags', 'math, easy');

      mockDb.question.create.mockResolvedValue({ id: 'q-1' });

      const result = await createQuestion(formData);

      expect(result).toEqual({ success: true });
      expect(mockDb.question.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          text: 'What is 2+2?',
          correctIndex: 1,
          options: expect.stringContaining('["3","4","5","6"]'),
          creator: { connect: { id: 'user-123' } },
        }),
      });
    });

    it('should fail with invalid data', async () => {
      const formData = new FormData();
      formData.append('text', 'Bad Q'); // Too short if min is 3? schema says min(3)
      // Missing options
      formData.append('correctIndex', '0');

      const result = await createQuestion(formData);
      expect(result).toEqual({ error: 'Invalid data' });
      expect(mockDb.question.create).not.toHaveBeenCalled();
    });
  });

  describe('updateQuestion', () => {
    it('should update a question successfully', async () => {
        const formData = new FormData();
        formData.append('id', 'q-1');
        formData.append('text', 'Updated Question?');
        formData.append('option0', 'A');
        formData.append('option1', 'B');
        formData.append('option2', 'C');
        formData.append('option3', 'D');
        formData.append('correctIndex', '0');

        // Mock existing question
        mockDb.question.findUnique.mockResolvedValue({
          id: 'q-1',
          creatorId: 'user-123',
          isLocked: false,
        });

        mockDb.question.update.mockResolvedValue({ id: 'q-1' });

        const result = await updateQuestion(formData);

        expect(result).toEqual({ success: true });
        expect(mockDb.question.update).toHaveBeenCalledWith({
          where: { id: 'q-1' },
          data: expect.objectContaining({
            text: 'Updated Question?',
            correctIndex: 0,
          }),
        });
      });

    it('should prevent unauthorized updates', async () => {
      const formData = new FormData();
      formData.append('id', 'q-2');
      formData.append('text', 'Hacked?');
      formData.append('option0', 'A');
      formData.append('option1', 'B');
      formData.append('option2', 'C');
      formData.append('option3', 'D');
      formData.append('correctIndex', '0');

      // Mock existing question owned by someone else and locked
      mockDb.question.findUnique.mockResolvedValue({
        id: 'q-2',
        creatorId: 'other-user',
        isLocked: true,
      });

      const result = await updateQuestion(formData);

      expect(result).toEqual({ error: 'Unauthorized: Private question' });
      expect(mockDb.question.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteQuestion', () => {
    it('should soft delete a question', async () => {
      mockDb.question.findUnique.mockResolvedValue({
        id: 'q-1',
        creatorId: 'user-123',
      });

      const result = await deleteQuestion('q-1');

      expect(result).toEqual({ success: true });
      expect(mockDb.question.update).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        data: expect.objectContaining({
            deletedAt: expect.any(Date),
            deletedById: 'user-123'
        }),
      });
    });

    it('should prevent unauthorized deletion', async () => {
      mockDb.question.findUnique.mockResolvedValue({
        id: 'q-2',
        creatorId: 'other-user',
      });

      const result = await deleteQuestion('q-2');

      expect(result).toEqual({ error: 'Forbidden' });
      expect(mockDb.question.update).not.toHaveBeenCalled();
    });

    it('should fail if question not found during deletion', async () => {
        mockDb.question.findUnique.mockResolvedValue(null);
        const result = await deleteQuestion('q-none');
        expect(result).toEqual({ error: 'Not found' });
    });
  });

  describe('restoreQuestion', () => {
    it('should restore a question', async () => {
        mockDb.question.findUnique.mockResolvedValue({
            id: 'q-1',
            creatorId: 'user-123',
            isLocked: false
        });

      const result = await restoreQuestion('q-1');

      expect(result).toEqual({ success: true });
      expect(mockDb.question.update).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        data: { deletedAt: null, deletedById: null },
      });
    });

    it('should fail if no session', async () => {
        mockSession.user = null as any;
        const result = await restoreQuestion('q-1');
        expect(result).toEqual({ error: 'Unauthorized' });
        mockSession.user = { id: 'user-123', role: 'USER' };
    });

    it('should fail if unauthorized to restore', async () => {
        mockDb.question.findUnique.mockResolvedValue({ id: 'q-1', creatorId: 'other', isLocked: true });
        mockSession.user.role = 'USER';
        const result = await restoreQuestion('q-1');
        expect(result).toEqual({ error: 'Forbidden' });
    });

    it('should fail if question not found during restore', async () => {
        mockDb.question.findUnique.mockResolvedValue(null);
        const result = await restoreQuestion('q-none');
        expect(result).toEqual({ error: 'Not found' });
    });
  });

  describe('importSingleQuestion', () => {
    it('should import a valid question JSON', async () => {
      const json = JSON.stringify({
        text: 'Imported Q',
        options: ['Yes', 'No'],
        correctIndex: 0,
        explanation: 'Because yes',
        tags: ['import'],
      });

      mockDb.question.create.mockResolvedValue({ id: 'q-new' });

      const result = await importSingleQuestion(json);

      expect(result).toEqual({ success: true });
      expect(mockDb.question.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          text: 'Imported Q',
          options: '["Yes","No"]',
          correctIndex: 0,
          creatorId: 'user-123',
        }),
      });
    });

    it('should fail with invalid JSON', async () => {
      const result = await importSingleQuestion('{ invalid json ');
      expect(result).toEqual({ error: 'Invalid JSON format' });
    });

    it('should fail with invalid data structure', async () => {
      const json = JSON.stringify({
        text: 'Missing options',
      });
      const result = await importSingleQuestion(json);
      expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining('Invalid data structure') }));
    });

    it('should handle database error during import', async () => {
        const json = JSON.stringify({
            text: 'Imported Q',
            options: ['Yes', 'No'],
            correctIndex: 0,
        });
        mockDb.question.create.mockRejectedValue(new Error('Db fail'));
        const result = await importSingleQuestion(json);
        expect(result).toEqual({ error: 'Database error during import' });
    });
  });

  describe('getTrashedQuestions', () => {
    it('should return trashed questions for user', async () => {
      mockDb.question.findMany.mockResolvedValue([
        { id: 'q-1', text: 'Trashed', options: '["A","B"]' }
      ]);
      const result = await getTrashedQuestions();
      expect(result).toHaveLength(1);
      expect(result[0].options).toEqual(['A', 'B']);
      expect(mockDb.question.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ deletedAt: expect.any(Object) })
      }));
    });

    it('should return empty array if no session', async () => {
        // Force session null by mocking auth again for this test or changing mockSession
        // But mockSession is hoisted. Let's try to change its value.
        mockSession.user = null as any;
        const result = await getTrashedQuestions();
        expect(result).toEqual([]);
        mockSession.user = { id: 'user-123', role: 'USER' }; // Reset
    });
  });

  describe('toggleLock', () => {
    it('should lock a question', async () => {
      mockDb.question.findUnique.mockResolvedValue({ id: 'q-1', creatorId: 'user-123', isLocked: false });
      await toggleLock('q-1');
      expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ isLocked: true })
      }));
    });

    it('should unlock and make public if in locked collection', async () => {
        mockDb.question.findUnique.mockResolvedValue({ id: 'q-1', creatorId: 'user-123', isLocked: true });
        mockDb.collection.count.mockResolvedValue(1); // In a locked collection
        await toggleLock('q-1');
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({ isLocked: false, isPermanentlyPublic: true })
        }));
      });

    it('should fail if permanently public and not admin', async () => {
        mockDb.question.findUnique.mockResolvedValue({ id: 'q-1', creatorId: 'user-123', isPermanentlyPublic: true });
        const result = await toggleLock('q-1');
        expect(result).toEqual({ error: 'Cannot lock a permanently public question' });
    });

    it('should allow admin to override permanently public lock', async () => {
        mockDb.question.findUnique.mockResolvedValue({ id: 'q-1', creatorId: 'user-123', isPermanentlyPublic: true });
        mockSession.user.role = 'ADMIN';
        await toggleLock('q-1');
        expect(mockDb.question.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ isLocked: true })
        }));
    });

    it('should fail if question not found during toggleLock', async () => {
        mockDb.question.findUnique.mockResolvedValue(null);
        const result = await toggleLock('q-none');
        expect(result).toEqual({ error: 'Not found' });
    });
  });
});
