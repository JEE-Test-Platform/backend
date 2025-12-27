import { studentService } from '../src/services/studentService';

async function verify() {
    const attemptId = 'cmjn7abyo0019nliu7wuyvk0r'; // Replace with a valid attempt ID from your DB
    try {
        const metrics = await studentService.getTestAttemptMetrics(attemptId);
        console.log('--- Behavioral Patterns ---');
        console.log(JSON.stringify(metrics.behavioralPatterns, null, 2));

        console.log('\n--- Subject Performance ---');
        console.log(JSON.stringify(metrics.subjectPerformance, null, 2));
    } catch (e) {
        console.error('Verification failed:', e);
    }
}

verify();
