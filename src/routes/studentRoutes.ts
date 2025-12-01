import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { studentController } from '../controllers/studentController';

const router = Router();

// All routes require authentication and STUDENT role
router.use(authenticate);
router.use(authorize(Role.STUDENT));

// Dashboard - Get student overview
router.get('/dashboard', studentController.getDashboard);

// Tests - Get available tests for student's institute
router.get('/tests/available', studentController.getAvailableTests);

// Tests - Get upcoming tests
router.get('/tests/upcoming', studentController.getUpcomingTests);

// Tests - Get completed tests
router.get('/tests/completed', studentController.getCompletedTests);

// Test Attempt - Start a new test attempt
router.post('/tests/:testActivationId/start', studentController.startTest);

// Test Attempt - Get current test attempt
router.get('/attempts/:attemptId', studentController.getTestAttempt);

// Test Attempt - Save answer
router.post('/attempts/:attemptId/answer', studentController.saveAnswer);

// Test Attempt - Mark question for review
router.post('/attempts/:attemptId/mark-review', studentController.markForReview);

// Test Attempt - Submit test
router.post('/attempts/:attemptId/submit', studentController.submitTest);

// Results - Get all attempts history (must come before :attemptId route)
router.get('/results/history', studentController.getAttemptsHistory);

// Results - Get test result
router.get('/results/:attemptId', studentController.getTestResult);

// Analytics - Get performance analytics
router.get('/analytics/performance', studentController.getPerformanceAnalytics);

// Analytics - Get subject-wise performance
router.get('/analytics/subject-wise', studentController.getSubjectWisePerformance);

export default router;
