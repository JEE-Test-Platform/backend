import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';
import { studentService } from '../services/studentService';
import { aiAnalysisService } from '../services/aiAnalysisService';
import prisma from '../utils/prisma';

console.log(' [Worker] Initializing AI Report Worker...');

export const reportWorker = new Worker(
    'ai-report-queue',
    async (job: Job) => {
        const { attemptId } = job.data;
        console.log(`[Worker] Processing report for attempt: ${attemptId}`);

        try {
            // 1. Update status to IN_PROGRESS
            await prisma.testAttempt.update({
                where: { id: attemptId },
                data: { analysisStatus: 'IN_PROGRESS' },
            });

            // 2. Fetch metrics
            const metrics = await studentService.getTestAttemptMetrics(attemptId);

            // 3. Generate AI Report
            const report = await aiAnalysisService.generateTestReport(metrics);

            // 4. Update Database
            await prisma.testAttempt.update({
                where: { id: attemptId },
                data: {
                    aiAnalysisReport: report,
                    analysisStatus: 'COMPLETED',
                },
            });

            console.log(`[Worker] Successfully generated report for attempt: ${attemptId}`);
        } catch (error) {
            console.error(`[Worker] Failed to generate report for attempt: ${attemptId}`, error);

            // Update status to FAILED
            await prisma.testAttempt.update({
                where: { id: attemptId },
                data: { analysisStatus: 'FAILED' },
            }).catch(e => console.error('[Worker] Failed to update failure status', e));

            throw error; // Let BullMQ handle retries
        }
    },
    {
        connection,
        concurrency: 5, // Process up to 5 reports at a time
    }
);

reportWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
});

reportWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
});
