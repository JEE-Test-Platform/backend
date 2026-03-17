import { Response } from 'express';
import { AuthRequest } from '../types';
import { TeacherService } from '../services/teacherService';
import { Difficulty, QuestionNature } from '@prisma/client';

const teacherService = new TeacherService();

export class TeacherController {
  // GET /api/teacher/master-tests
  async getMasterTests(req: AuthRequest, res: Response): Promise<any> {
    try {
      const tests = await teacherService.getMasterTests();
      return res.json({ success: true, data: tests });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/teacher/master-tests/:testId/questions
  async getTestQuestions(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { testId } = req.params;
      const teacherId = req.user!.profileId!;

      const result = await teacherService.getTestQuestions(testId, teacherId);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      const status = error.message === 'Test not found' ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  // PATCH /api/teacher/questions/:questionId/label
  async updateQuestionLabel(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { questionId } = req.params;
      const teacherId = req.user!.profileId!;
      const { difficulty, nature } = req.body;

      if (!difficulty && !nature) {
        return res.status(400).json({
          success: false,
          message: 'Provide at least one of: difficulty, nature',
        });
      }

      if (difficulty && !Object.values(Difficulty).includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: `Invalid difficulty. Must be one of: ${Object.values(Difficulty).join(', ')}`,
        });
      }

      if (nature && !Object.values(QuestionNature).includes(nature)) {
        return res.status(400).json({
          success: false,
          message: `Invalid nature. Must be one of: ${Object.values(QuestionNature).join(', ')}`,
        });
      }

      const updated = await teacherService.updateQuestionLabel(questionId, teacherId, {
        difficulty,
        nature,
      });

      return res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error.message === 'Question not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message.includes('only label questions')) {
        return res.status(403).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /api/teacher/master-tests/:testId/bulk-label
  async bulkUpdateLabels(req: AuthRequest, res: Response): Promise<any> {
    try {
      const teacherId = req.user!.profileId!;
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: 'updates must be a non-empty array' });
      }

      const results = await teacherService.bulkUpdateLabels(teacherId, updates);
      return res.json({ success: true, data: results, count: results.length });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
