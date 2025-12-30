import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockSession } = vi.hoisted(() => {
  return {
    mockDb: {
      question: {
        create: vi.fn(),
      },
      tag: {
        connectOrCreate: vi.fn(),
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

import { importSingleQuestion } from '@/app/[locale]/(app)/questions/actions';

describe('Import Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import a valid question JSON', async () => {
    const validJson = JSON.stringify({
      text: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      correctIndex: 1,
      tags: ['math', 'simple'],
    });

    const result = await importSingleQuestion(validJson);

    expect(result).toEqual({ success: true });
    expect(mockDb.question.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        text: 'What is 2+2?',
        options: JSON.stringify(['3', '4', '5', '6']),
        correctIndex: 1,
      }),
    }));
  });

  it('should fail with invalid JSON', async () => {
    const invalidJson = '{ invalid: json }';
    const result = await importSingleQuestion(invalidJson);
    expect(result).toHaveProperty('error', 'Invalid JSON format');
  });

  it('should fail with invalid data structure', async () => {
    const badData = JSON.stringify({
      text: '', // too short
      options: ['one'], // too few
      correctIndex: 0,
    });
    const result = await importSingleQuestion(badData);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('Invalid data structure');
  });
});
