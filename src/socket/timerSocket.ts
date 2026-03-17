import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

// Map of attemptId → active interval handle
const timerIntervals = new Map<string, NodeJS.Timeout>();

export function registerTimerSocket(io: SocketIOServer) {
  // Authenticate every socket connection via JWT in handshake auth
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join-attempt', async ({ attemptId }: { attemptId: string }) => {
      const user = (socket as any).user;

      try {
        // Validate ownership and fetch timing info
        const attempt = await prisma.testAttempt.findFirst({
          where: {
            id: attemptId,
            student: { userId: user.userId },
          },
          include: {
            testActivation: {
              include: { masterTest: true },
            },
          },
        });

        if (!attempt) {
          socket.emit('timer-error', { message: 'Attempt not found' });
          return;
        }

        if (attempt.status !== 'IN_PROGRESS') {
          // Test already submitted or expired — tell client immediately
          socket.emit('expired', { attemptId });
          return;
        }

        // Join a room keyed by attemptId so we can broadcast to all tabs
        socket.join(attemptId);
        console.log(`[Socket] ${socket.id} joined attempt room: ${attemptId}`);

        const durationSec = attempt.testActivation.masterTest.duration * 60;

        // If an interval is already running for this attempt (another tab),
        // we don't create a second one — the room broadcast covers all members.
        if (!timerIntervals.has(attemptId)) {
          const tick = () => {
            const elapsed = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
            const remaining = Math.max(0, durationSec - elapsed);

            io.to(attemptId).emit('timer', { remaining });

            if (remaining <= 0) {
              io.to(attemptId).emit('expired', { attemptId });
              clearTimerInterval(attemptId);
            }
          };

          tick(); // emit immediately on join so client doesn't wait 1s
          const interval = setInterval(tick, 1000);
          timerIntervals.set(attemptId, interval);
        } else {
          // Interval already running — emit current time immediately for this tab
          const elapsed = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
          const remaining = Math.max(0, durationSec - elapsed);
          socket.emit('timer', { remaining });
        }
      } catch (err) {
        console.error('[Socket] Error in join-attempt:', err);
        socket.emit('timer-error', { message: 'Failed to join attempt' });
      }
    });

    socket.on('leave-attempt', ({ attemptId }: { attemptId: string }) => {
      socket.leave(attemptId);
      console.log(`[Socket] ${socket.id} left attempt room: ${attemptId}`);
      // Do NOT clear the interval here — other tabs in the room still need it.
      // The interval is only cleared on submit/expire.
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Stop the server-side tick for an attempt.
 * Called when the attempt is submitted or expires.
 */
export function clearTimerInterval(attemptId: string) {
  const interval = timerIntervals.get(attemptId);
  if (interval) {
    clearInterval(interval);
    timerIntervals.delete(attemptId);
    console.log(`[Socket] Cleared timer interval for attempt: ${attemptId}`);
  }
}
