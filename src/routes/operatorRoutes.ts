import { Router } from 'express';
import { operatorController, csvUpload } from '../controllers/operatorController';
import { authenticate, authorize } from '../middleware/auth';
import { imageUpload } from '../middleware/imageUpload';
import { imageUrlValidator } from '../middleware/imageUrlHandler';

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

// Image upload route (for blob storage)
router.post('/upload-image', imageUpload, operatorController.uploadImage);

// CSV upload routes (with image URL validation)
router.post('/csv/validate', csvUpload, operatorController.validateCSV);
router.post('/csv/upload', csvUpload, imageUrlValidator, operatorController.createTestFromCSV);

// Rich text editor routes (with image URL validation)
router.post('/tests/create-with-questions', imageUrlValidator, operatorController.createTestWithQuestions);

// Draft test workflow routes
router.post('/tests/draft', operatorController.createDraftTest);
router.get('/tests/:testId/draft', operatorController.getDraftTest);
router.post('/tests/:testId/questions', imageUrlValidator, operatorController.addQuestion);
router.patch('/tests/:testId/questions/reorder', operatorController.reorderQuestions);
router.put('/tests/:testId/questions/:questionId', imageUrlValidator, operatorController.updateQuestion);
router.delete('/tests/:testId/questions/:questionId', operatorController.deleteQuestion);
router.patch('/tests/:testId/publish', operatorController.publishTest);
router.patch('/tests/:testId/unpublish', operatorController.unpublishTest);
router.post('/tests/:testId/activate-all', operatorController.activateTestForAllInstitutes);

export default router;
