import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Improved connection logic for production (supports Azure Cache for Redis SSL/TLS)
// Typed as `any` to avoid ioredis version mismatch with bullmq's bundled ioredis
export const connection: any = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    // Enable TLS for rediss:// URLs (Azure Redis often requires this on port 6380)
    ...(redisUrl.startsWith('rediss') ? {
        tls: {
            rejectUnauthorized: false // Often needed for Azure's default certificates, though CA can be provided
        }
    } : {})
});

connection.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
});

export const testExpiryQueue = new Queue('test-expiry', {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
    },
});

export const reportQueue = new Queue('ai-report-queue', {
    connection: connection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
    },
});

export const addReportJob = async (attemptId: string) => {
    try {
        await reportQueue.add('generate-report', { attemptId });
        console.log(`[Queue] Added report job for attempt: ${attemptId}`);
    } catch (error) {
        console.error(`[Queue] Failed to add report job:`, error);
    }
};
