/**
 * timerSocket.test.ts
 * Tests the server-side WebSocket timer.
 *
 * Strategy: spin up a real HTTP + Socket.io server per test suite,
 * mock Prisma and JWT so no database or auth service is needed.
 */

import { createServer } from 'http';
import { AddressInfo } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';

// ── Mocks must be declared before any imports that use them ──────────────────

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    testAttempt: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: { verify: jest.fn() },
  verify: jest.fn(),
}));

// ── Import after mocks are in place ─────────────────────────────────────────

import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma';
import { registerTimerSocket, clearTimerInterval } from '../../socket/timerSocket';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for a single named event from a socket, or reject after `ms` ms. */
function waitForEvent<T = any>(socket: ClientSocket, event: string, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), ms);
    socket.once(event, (data: T) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

/** Connect a client and wait for the `connect` event. Rejects on `connect_error`. */
function connectClient(url: string, token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioc(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => { socket.disconnect(); reject(err); });
  });
}

/** Build a mock TestAttempt that `findFirst` will return. */
function makeAttempt(overrides: Partial<{
  status: string;
  startedAt: Date;
  durationMinutes: number;
}> = {}) {
  const startedAt = overrides.startedAt ?? new Date();
  const durationMinutes = overrides.durationMinutes ?? 60;
  return {
    id: 'attempt-1',
    status: overrides.status ?? 'IN_PROGRESS',
    startedAt,
    testActivation: {
      masterTest: { duration: durationMinutes },
    },
  };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('timerSocket', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let serverUrl: string;

  const VALID_TOKEN = 'valid-token';
  const VALID_USER = { userId: 'user-123' };

  beforeAll((done) => {
    httpServer = createServer();
    io = new SocketIOServer(httpServer, { transports: ['websocket'] });
    registerTimerSocket(io);
    httpServer.listen(0, () => {
      const { port } = httpServer.address() as AddressInfo;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    io.close();
    httpServer.close(done);
  });

  beforeEach(() => {
    // Default: valid JWT resolves to VALID_USER
    (jwt.verify as jest.Mock).mockReturnValue(VALID_USER);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear any lingering server-side interval so tests don't interfere.
    clearTimerInterval('attempt-1');
  });

  // ── Authentication ─────────────────────────────────────────────────────────

  describe('authentication middleware', () => {
    it('rejects a connection that sends no token', async () => {
      await expect(connectClient(serverUrl /* no token */)).rejects.toThrow();
    });

    it('rejects a connection with an invalid / expired token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });
      await expect(connectClient(serverUrl, 'bad-token')).rejects.toThrow();
    });

    it('accepts a connection with a valid token', async () => {
      const client = await connectClient(serverUrl, VALID_TOKEN);
      expect(client.connected).toBe(true);
      client.disconnect();
    });
  });

  // ── join-attempt ───────────────────────────────────────────────────────────

  describe('join-attempt event', () => {
    it('emits timer-error when the attempt does not exist', async () => {
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(null);

      const client = await connectClient(serverUrl, VALID_TOKEN);
      client.emit('join-attempt', { attemptId: 'ghost-attempt' });

      const error = await waitForEvent<{ message: string }>(client, 'timer-error');
      expect(error.message).toBe('Attempt not found');
      client.disconnect();
    });

    it('emits expired immediately when the attempt is already SUBMITTED', async () => {
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(
        makeAttempt({ status: 'SUBMITTED' }),
      );

      const client = await connectClient(serverUrl, VALID_TOKEN);
      client.emit('join-attempt', { attemptId: 'attempt-1' });

      const data = await waitForEvent<{ attemptId: string }>(client, 'expired');
      expect(data.attemptId).toBe('attempt-1');
      client.disconnect();
    });

    it('emits an immediate timer event with the correct remaining seconds', async () => {
      // Test started 5 minutes ago, total duration 60 minutes → 55 minutes remain
      const startedAt = new Date(Date.now() - 5 * 60 * 1000);
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(
        makeAttempt({ startedAt, durationMinutes: 60 }),
      );

      const client = await connectClient(serverUrl, VALID_TOKEN);
      client.emit('join-attempt', { attemptId: 'attempt-1' });

      const { remaining } = await waitForEvent<{ remaining: number }>(client, 'timer');

      // Allow ±2 s tolerance for test execution time
      expect(remaining).toBeGreaterThanOrEqual(55 * 60 - 2);
      expect(remaining).toBeLessThanOrEqual(55 * 60 + 2);
      client.disconnect();
    });

    it('sends timer events at regular intervals', async () => {
      // 10 s elapsed on a 60-second test → ~50 s remain.
      const startedAt = new Date(Date.now() - 10 * 1000);
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(
        makeAttempt({ startedAt, durationMinutes: 1 }),
      );

      const client = await connectClient(serverUrl, VALID_TOKEN);
      const received: number[] = [];
      client.on('timer', ({ remaining }: { remaining: number }) => received.push(remaining));

      client.emit('join-attempt', { attemptId: 'attempt-1' });

      // Wait for the initial tick (immediate) and then one more (~1 s later).
      await waitForEvent(client, 'timer');
      await waitForEvent(client, 'timer');

      expect(received.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < received.length; i++) {
        expect(received[i]).toBeLessThanOrEqual(received[i - 1]);
      }

      client.disconnect();
    });

    it('emits expired and stops ticking when remaining reaches 0', async () => {
      // 59 s elapsed on a 1-minute test → ~1 second remains; expired fires quickly.
      const startedAt = new Date(Date.now() - 59 * 1000);
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(
        makeAttempt({ startedAt, durationMinutes: 1 }),
      );

      const client = await connectClient(serverUrl, VALID_TOKEN);
      const expiredPromise = waitForEvent<{ attemptId: string }>(client, 'expired', 5000);

      client.emit('join-attempt', { attemptId: 'attempt-1' });

      const data = await expiredPromise;
      expect(data.attemptId).toBe('attempt-1');

      client.disconnect();
    });

    it('does not create a second interval when a second tab joins the same attempt', async () => {
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(
        makeAttempt({ durationMinutes: 60 }),
      );

      const clientA = await connectClient(serverUrl, VALID_TOKEN);
      const clientB = await connectClient(serverUrl, VALID_TOKEN);

      // Both join the same attempt — only ONE interval should be running
      clientA.emit('join-attempt', { attemptId: 'attempt-1' });
      await waitForEvent(clientA, 'timer'); // wait for first tick

      // prisma is called once per join (to validate ownership), so called twice
      expect(prisma.testAttempt.findFirst).toHaveBeenCalledTimes(1);

      clientB.emit('join-attempt', { attemptId: 'attempt-1' });
      await waitForEvent(clientB, 'timer');

      // Both clients receive timer events (room broadcast works)
      expect(prisma.testAttempt.findFirst).toHaveBeenCalledTimes(2);

      clientA.disconnect();
      clientB.disconnect();
    });
  });

  // ── clearTimerInterval ─────────────────────────────────────────────────────

  describe('clearTimerInterval', () => {
    it('stops future timer emissions for the attempt', async () => {
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(
        makeAttempt({ durationMinutes: 60 }),
      );

      const client = await connectClient(serverUrl, VALID_TOKEN);

      // Wait for first tick before clearing so we know the interval is running.
      const firstTick = waitForEvent(client, 'timer');
      client.emit('join-attempt', { attemptId: 'attempt-1' });
      await firstTick;

      // Simulate student submitting early → interval cleared.
      clearTimerInterval('attempt-1');

      // Any timer event within the next 1.5 s (> one interval period) would mean
      // the interval was not stopped.
      await expect(waitForEvent(client, 'timer', 1500)).rejects.toThrow('Timed out');

      client.disconnect();
    });
  });
});
