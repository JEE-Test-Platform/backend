import { Router } from 'express';
import { operatorController, csvUpload } from '../controllers/operatorController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require operator authentication
router.use(authenticate, authorize('OPERATOR'));

// Dashboard
router.get('/dashboard', operatorController.getDashboard);

// Master test management
router.get('/master-tests', operatorController.getMasterTests);
router.get('/master-tests/:testId', operatorController.getTestDetails);
router.post('/master-tests', operatorController.createMasterTest);
router.patch('/master-tests/:testId', operatorController.updateTest);
router.patch('/master-tests/:testId/deactivate', operatorController.deactivateTest);
router.get('/master-tests/:testId/statistics', operatorController.getTestStatistics);

// CSV upload routes
router.post('/csv/validate', csvUpload, operatorController.validateCSV);
router.post('/csv/upload', csvUpload, operatorController.createTestFromCSV);

// Rich text editor routes
router.post('/tests/create-with-questions', operatorController.createTestWithQuestions);

export default router;
