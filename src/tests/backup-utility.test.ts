import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { performBackup } from '@/lib/backup';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
  }
}));

describe('Backup Utility', () => {
  const config = {
    databaseUrl: 'file:./prisma/dev.db',
    backupDir: './backups',
    retention: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip backup if not a file URL', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };
    await performBackup({ ...config, databaseUrl: 'postgres://localhost' }, logger);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Only SQLite'));
  });

  it('should fail if database file does not exist', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };
    (fs.existsSync as any).mockReturnValue(false);
    await performBackup(config, logger);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database file not found'));
  });

  it('should create backup and rotate old ones', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };
    
    // 1. Exists check for db file
    (fs.existsSync as any).mockImplementation((p: string) => p.includes('dev.db') || p.includes('backups'));
    
    // 2. Readdir for rotation (should include the new one too in real life, but here we just mock the result)
    (fs.readdirSync as any).mockReturnValue([
        'backup-1.sqlite',
        'backup-2.sqlite',
        'backup-3.sqlite',
        'backup-4.sqlite'
    ]);
    
    // 3. Stat for sorting
    (fs.statSync as any).mockImplementation((p: string) => ({
        mtime: { getTime: () => parseInt(p.match(/\d+/)![0]) }
    }));

    await performBackup(config, logger);

    expect(fs.copyFileSync).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('backup created'));
    
    // Retention is 2, we had 3 files + 1 new. Should delete 2 oldest.
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
  });
});
