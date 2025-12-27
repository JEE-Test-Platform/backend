import { Queue, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Improved connection logic for production (supports Azure Cache for Redis SSL/TLS)
export const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    // Enable TLS for rediss:// URLs (Azure Redis often requires this on port 6380)
    ...(redisUrl.startsWith('rediss') ? {
        tls: {
            rejectUnauthorized: false // Often needed for Azure's default certificates, though CA can be provided
        }
    } : {})
});

export const reportQueue = new Queue('ai-report-queue', {
    connection,
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
