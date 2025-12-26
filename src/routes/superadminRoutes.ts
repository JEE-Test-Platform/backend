import { Router } from 'express';
import * as superadminController from '../controllers/superadminController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require SUPER_ADMIN authentication
router.use(authenticate, authorize('SUPER_ADMIN'));

// Dashboard
router.get('/dashboard', superadminController.getDashboard);

// Operator Management
router.get('/operators', superadminController.getAllOperators);
router.post('/operators', superadminController.createOperator);
router.get('/operators/:operatorId', superadminController.getOperatorById);
router.patch('/operators/:operatorId', superadminController.updateOperator);
router.delete('/operators/:operatorId', superadminController.deleteOperator);
router.patch('/operators/:operatorId/toggle-status', superadminController.toggleOperatorStatus);

// Institute Management
router.get('/institutes', superadminController.getAllInstitutes);
router.post('/institutes', superadminController.createInstitute);
router.get('/institutes/:instituteId', superadminController.getInstituteById);
router.patch('/institutes/:instituteId', superadminController.updateInstitute);
router.delete('/institutes/:instituteId', superadminController.deleteInstitute);
router.patch('/institutes/:instituteId/verify', superadminController.verifyInstitute);
router.patch('/institutes/:instituteId/toggle-status', superadminController.toggleInstituteStatus);

// Student Management
router.get('/students', superadminController.getAllStudents);
router.get('/students/:studentId', superadminController.getStudentById);
router.patch('/students/:studentId', superadminController.updateStudent);
router.delete('/students/:studentId', superadminController.deleteStudent);
router.patch('/students/:studentId/toggle-status', superadminController.toggleStudentStatus);

// Analytics
router.get('/analytics/performance', superadminController.getPerformanceAnalytics);
router.get('/analytics/top-performers', superadminController.getTopPerformers);

export default router;
