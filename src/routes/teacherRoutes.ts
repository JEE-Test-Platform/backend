import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { TeacherController } from '../controllers/teacherController';

const router = Router();
const controller = new TeacherController();

// All teacher routes require authentication + TEACHER role
router.use(authenticate);
router.use(authorize(Role.TEACHER));

// Browse all tests (draft + published)
router.get('/master-tests', (req, res) => controller.getMasterTests(req, res));

// Get a test's questions filtered to this teacher's subject
router.get('/master-tests/:testId/questions', (req, res) =>
  controller.getTestQuestions(req, res)
);

// Label a single question (set difficulty / nature)
router.patch('/questions/:questionId/label', (req, res) =>
  controller.updateQuestionLabel(req, res)
);

// Bulk-label multiple questions in one request
router.patch('/master-tests/:testId/bulk-label', (req, res) =>
  controller.bulkUpdateLabels(req, res)
);

export default router;
