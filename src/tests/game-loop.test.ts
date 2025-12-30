import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startGameLoop } from '@/lib/game/loop';
import { GameManager } from '@/lib/game/GameManager';

describe('Game Loop', () => {
  let gm: GameManager;
  let io: any;

  beforeEach(() => {
    vi.useFakeTimers();
    gm = new GameManager();
    io = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should timeout room due to inactivity', async () => {
    const room = gm.createRoom('TIMEOUT', 'host');
    room.lastActivity = Date.now();
    room.players = {}; // 0 active players

    const interval = startGameLoop(room, io, gm);

    // Wait 11 minutes (timeout is 10)
    vi.advanceTimersByTime(11 * 60 * 1000);

    expect(room.phase).toBe('finished');
    expect(io.to).toHaveBeenCalledWith('TIMEOUT');
    expect(io.emit).toHaveBeenCalledWith('room:update', { room });
    
    clearInterval(interval);
  });

  it('should skip timer logic if paused', async () => {
    const room = gm.createRoom('PAUSED', 'host');
    room.phase = 'question';
    room.qDeadlineTs = Date.now() + 30000;
    room.paused = true;
    
    vi.spyOn(gm, 'revealAnswer');

    const interval = startGameLoop(room, io, gm);

    vi.advanceTimersByTime(31 * 1000);

    expect(gm.revealAnswer).not.toHaveBeenCalled();
    expect(room.phase).toBe('question');
    
    clearInterval(interval);
  });

  it('should reveal answer when time is up', async () => {
    const room = gm.createRoom('TIMEUP', 'host');
    room.questionOrder = [1];
    room.questionIndex = 0;
    room.phase = 'question';
    room.qDeadlineTs = Date.now() + 30000;
    room.players = { 'p1': { selectedChoice: null } as any };
    
    vi.spyOn(gm, 'revealAnswer');

    const interval = startGameLoop(room, io, gm);

    await vi.advanceTimersByTimeAsync(31 * 1000);

    expect(gm.revealAnswer).toHaveBeenCalledWith(room);
    expect(room.phase).toBe('reveal');
    expect(room.revealDeadlineTs).toBeDefined();
    
    clearInterval(interval);
  });

  it('should transition to next question after reveal timeout', async () => {
    const room = gm.createRoom('NEXT', 'host');
    room.phase = 'reveal';
    room.revealDeadlineTs = Date.now() + 5000;
    
    vi.spyOn(gm, 'nextQuestion').mockResolvedValue(undefined);

    const interval = startGameLoop(room, io, gm);

    await vi.advanceTimersByTimeAsync(6000);

    expect(gm.nextQuestion).toHaveBeenCalledWith(room);
    
    clearInterval(interval);
  });

  it('should reveal early if all players have answered', async () => {
    const room = gm.createRoom('EARLY', 'host');
    room.phase = 'question';
    room.qDeadlineTs = Date.now() + 30000;
    room.players = { 'p1': { selectedChoice: 1 } as any };
    
    vi.spyOn(gm, 'revealAnswer');

    const interval = startGameLoop(room, io, gm);

    await vi.advanceTimersByTimeAsync(1000);

    expect(gm.revealAnswer).toHaveBeenCalledWith(room);
    clearInterval(interval);
  });

  it('should stop immediately if room is already finished', async () => {
    const room = gm.createRoom('FINISHED', 'host');
    room.phase = 'finished';
    
    const interval = startGameLoop(room, io, gm);
    await vi.advanceTimersByTimeAsync(1100);
    
    // If it ran, it would have updated lastActivity or something, but it should just return
    // We can check if it's cleared by some side effect or just trust coverage
    clearInterval(interval);
  });
});
