import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';
import { studentService } from '../services/studentService';

console.log('[Worker] Initializing Test Expiry Worker...');

export const testExpiryWorker = new Worker(
    'test-expiry',
    async (job: Job) => {
        const { attemptId } = job.data;
        console.log(`[Worker] Auto-submitting expired attempt: ${attemptId}`);
        await studentService.autoSubmitExpiredTest(attemptId);
    },
    {
        connection,
        concurrency: 10,
    }
);

testExpiryWorker.on('completed', (job) => {
    console.log(`[Worker] Expiry job ${job.id} completed for attempt: ${job.data.attemptId}`);
});

testExpiryWorker.on('failed', (job, err) => {
    console.error(`[Worker] Expiry job ${job?.id} failed: ${err.message}`);
});
