import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHandlers } from '@/lib/game/socket-handlers';
import { GameManager } from '@/lib/game/GameManager';

describe('Socket Handlers', () => {
    let gm: GameManager;
    let io: any;
    let socket: any;

    beforeEach(() => {
        gm = new GameManager();
        io = {
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
        };
        socket = {
            id: 'sock-123',
            join: vi.fn(),
            emit: vi.fn(),
            on: vi.fn(),
        };
    });

    it('should handle create_room', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        
        registerHandlers(io, socket, gm);

        handlers['create_room']({ playerName: 'Alice', playerAvatar: 'A1', playerToken: 't1' });

        expect(socket.emit).toHaveBeenCalledWith('room:created', expect.any(Object));
        const code = (socket.emit as any).mock.calls[0][1].code;
        const room = gm.getRoom(code);
        expect(room).toBeDefined();
        expect(room?.hostToken).toBe('t1');
        expect(room?.players['t1'].name).toBe('Alice');
    });

    it('should handle join_room (new player)', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('JOIN1', 't1');
        
        handlers['join_room']({ code: 'JOIN1', playerToken: 't2', name: 'Bob' });

        expect(socket.emit).toHaveBeenCalledWith('room:joined', { code: 'JOIN1' });
        expect(room.players['t2']).toBeDefined();
        expect(room.players['t2'].name).toBe('Bob');
        expect(io.to).toHaveBeenCalledWith('JOIN1');
    });

    it('should handle join_room (reconnect)', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('RECON', 't1');
        room.players['t1'] = { token: 't1', socketId: 'old', name: 'Alice', avatar: 'A1', connected: false } as any;

        handlers['join_room']({ code: 'RECON', playerToken: 't1', name: 'Alice New', avatar: 'A2' });

        expect(room.players['t1'].socketId).toBe('sock-123');
        expect(room.players['t1'].connected).toBe(true);
        expect(room.players['t1'].name).toBe('Alice New');
    });

    it('should handle join_room error (not found)', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        handlers['join_room']({ code: 'NONE', playerToken: 't2' });
        expect(socket.emit).toHaveBeenCalledWith('error', 'Room not found');
    });

    it('should handle submit_answer', async () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('SUBMIT', 't1');
        room.phase = 'question';
        room.players['t1'] = { token: 't1', socketId: 'sock-123', name: 'Alice', selectedChoice: null } as any;

        await handlers['submit_answer']({ code: 'SUBMIT', choice: 1 });

        expect(room.players['t1'].selectedChoice).toBe(1);
        expect(io.emit).toHaveBeenCalled();
    });

    it('should handle use_joker (50/50)', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('J50', 't1');
        room.phase = 'question';
        room.correctIndex = 1;
        room.players['t1'] = { token: 't1', socketId: 'sock-123', joker5050: true, used5050ThisQ: false } as any;

        handlers['use_joker']({ code: 'J50', type: '5050' });

        expect(room.players['t1'].joker5050).toBe(false);
        expect(room.players['t1'].used5050ThisQ).toBe(true);
        expect(socket.emit).toHaveBeenCalledWith('joker_effect', expect.objectContaining({ type: '5050' }));
    });

    it('should handle update_settings', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('SETTINGS', 't1');
        room.players['t1'] = { token: 't1', socketId: 'sock-123' } as any;
        room.phase = 'lobby';

        handlers['update_settings']({ code: 'SETTINGS', settings: { simultaneousJokers: true } });

        expect(room.settings.simultaneousJokers).toBe(true);
        expect(io.to).toHaveBeenCalledWith('SETTINGS');
    });

    it('should handle pause and resume timer', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('PAUSE', 't1');
        room.players['t1'] = { token: 't1', socketId: 'sock-123' } as any;
        room.phase = 'question';
        room.qDeadlineTs = Date.now() + 30000;

        handlers['pause_timer']({ code: 'PAUSE' });
        expect(room.paused).toBe(true);
        expect(room.qDeadlineTs).toBeNull();
        expect(room.pauseRemaining).toBeDefined();

        handlers['resume_timer']({ code: 'PAUSE' });
        expect(room.paused).toBe(false);
        expect(room.qDeadlineTs).toBeGreaterThan(0);
    });

    it('should handle pause and resume timer in reveal phase', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('PAUSE_REV', 't1');
        room.players['t1'] = { token: 't1', socketId: 'sock-123' } as any;
        room.phase = 'reveal';
        room.revealDeadlineTs = Date.now() + 5000;

        handlers['pause_timer']({ code: 'PAUSE_REV' });
        expect(room.paused).toBe(true);
        expect(room.revealDeadlineTs).toBeNull();

        handlers['resume_timer']({ code: 'PAUSE_REV' });
        expect(room.paused).toBe(false);
        expect(room.revealDeadlineTs).toBeGreaterThan(0);
    });

    it('should handle skip_phase', async () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('SKIP', 't1');
        room.players['t1'] = { token: 't1', socketId: 'sock-123' } as any;
        room.phase = 'question';
        
        vi.spyOn(gm, 'revealAnswer').mockResolvedValue(undefined);

        await handlers['skip_phase']({ code: 'SKIP' });
        expect(gm.revealAnswer).toHaveBeenCalledWith(room);
    });

    it('should handle disconnect', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        vi.spyOn(gm, 'handleDisconnect').mockReturnValue({ roomCode: 'ROOM1', playerToken: 't1' });
        const room = gm.createRoom('ROOM1', 't1');

        handlers['disconnect']();
        expect(gm.handleDisconnect).toHaveBeenCalledWith('sock-123');
        expect(io.to).toHaveBeenCalledWith('ROOM1');
    });

    it('should handle start_game', async () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('START', 't1');
        room.players['t1'] = { token: 't1', socketId: 'sock-123' } as any;
        
        vi.spyOn(gm, 'startGame').mockResolvedValue(undefined);

        await handlers['start_game']({ code: 'START', config: {} });
        expect(gm.startGame).toHaveBeenCalledWith(room, {});
    });

    it('should handle delete_room', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('DEL', 't1');
        room.players['t1'] = { token: 't1', socketId: 'sock-123' } as any;

        handlers['delete_room']({ code: 'DEL' });
        expect(gm.getRoom('DEL')).toBeUndefined();
        expect(io.to).toHaveBeenCalledWith('DEL');
    });

    it('should handle all joker types', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('JOKERS', 't1');
        room.phase = 'question';
        room.settings.simultaneousJokers = true; // Allow multiple for easier testing
        room.players['t1'] = { token: 't1', socketId: 'sock-123', jokerRisk: true, jokerSpy: true } as any;

        handlers['use_joker']({ code: 'JOKERS', type: 'risk' });
        expect(room.players['t1'].jokerRisk).toBe(false);

        handlers['use_joker']({ code: 'JOKERS', type: 'spy' });
        expect(room.players['t1'].jokerSpy).toBe(false);
    });

    it('should prevent simultaneous jokers if disabled', () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('SIMUL', 't1');
        room.phase = 'question';
        room.settings.simultaneousJokers = false;
        room.jokerUsedThisQ = true;
        room.players['t1'] = { token: 't1', socketId: 'sock-123', jokerRisk: true } as any;

        handlers['use_joker']({ code: 'SIMUL', type: 'risk' });
        expect(socket.emit).toHaveBeenCalledWith('error', 'Joker already used this round!');
        expect(room.players['t1'].jokerRisk).toBe(true);
    });

    it('should handle skip_phase for reveal', async () => {
        const handlers: any = {};
        socket.on = vi.fn((event, cb) => { handlers[event] = cb; });
        registerHandlers(io, socket, gm);

        const room = gm.createRoom('SKIP_REV', 't1');
        room.players['t1'] = { token: 't1', socketId: 'sock-123' } as any;
        room.phase = 'reveal';
        
        vi.spyOn(gm, 'nextQuestion').mockResolvedValue(undefined);

        await handlers['skip_phase']({ code: 'SKIP_REV' });
        expect(gm.nextQuestion).toHaveBeenCalledWith(room);
    });
});
