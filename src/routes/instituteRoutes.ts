import { Router } from 'express';
import { instituteController } from '../controllers/instituteController';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// All routes require authentication and INSTITUTE role
router.use(authenticate);
router.use(authorize(Role.INSTITUTE));

// Dashboard
router.get('/dashboard', instituteController.getDashboard);

// Students management
router.get('/students', instituteController.getStudents);
router.post('/students', instituteController.addStudent);
router.post('/students/bulk-upload', instituteController.bulkUploadStudents);
router.patch('/students/:studentId/toggle-status', instituteController.toggleStudentStatus);

// Master tests
router.get('/master-tests', instituteController.getMasterTests);
router.get('/master-tests/:testId', instituteController.getMasterTestById);

// Test activations
router.get('/test-activations', instituteController.getTestActivations);
router.get('/test-activations/:activationId/details', instituteController.getActivationDetails);
router.post('/test-activations', instituteController.activateTest);
router.patch('/test-activations/:activationId/deactivate', instituteController.deactivateTest);
router.patch('/test-activations/:activationId/extend', instituteController.extendDeadline);

// Analytics
router.get('/analytics', instituteController.getAnalytics);

export default router;
