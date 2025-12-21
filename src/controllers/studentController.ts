import { Request, Response } from 'express';
import { studentService } from '../services/studentService';
import { AuthRequest } from '../types';

export const studentController = {
  // Get student dashboard overview
  getDashboard: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const dashboard = await studentService.getDashboard(userId);
      res.json({ success: true, data: dashboard });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
    }
  },

  // Get available tests
  getAvailableTests: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const tests = await studentService.getAvailableTests(userId);
      res.json({ success: true, data: tests });
    } catch (error) {
      console.error('Error fetching available tests:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch available tests' });
    }
  },

  // Get upcoming tests
  getUpcomingTests: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const tests = await studentService.getUpcomingTests(userId);
      res.json({ success: true, data: tests });
    } catch (error) {
      console.error('Error fetching upcoming tests:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch upcoming tests' });
    }
  },

  // Get completed tests
  getCompletedTests: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const tests = await studentService.getCompletedTests(userId);
      res.json({ success: true, data: tests });
    } catch (error) {
      console.error('Error fetching completed tests:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch completed tests' });
    }
  },

  // Start a new test attempt
  startTest: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { testActivationId } = req.params;
      const attempt = await studentService.startTest(userId, testActivationId);
      res.json({ success: true, data: attempt });
    } catch (error: any) {
      console.error('Error starting test:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to start test' });
    }
  },

  // Get current test attempt
  getTestAttempt: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { attemptId } = req.params;
      const attempt = await studentService.getTestAttempt(userId, attemptId);
      res.json({ success: true, data: attempt });
    } catch (error: any) {
      console.error('Error fetching test attempt:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to fetch test attempt' });
    }
  },

  // Save answer
  saveAnswer: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { attemptId } = req.params;
      const { questionId, selectedAnswer, timeSpent } = req.body;

      const answer = await studentService.saveAnswer(
        userId,
        attemptId,
        questionId,
        selectedAnswer,
        timeSpent
      );

      res.json({ success: true, data: answer });
    } catch (error: any) {
      console.error('Error saving answer:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to save answer' });
    }
  },

  // Mark question for review
  markForReview: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { attemptId } = req.params;
      const { questionId } = req.body;

      const result = await studentService.markForReview(userId, attemptId, questionId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error marking for review:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to mark for review' });
    }
  },

  // Submit test
  submitTest: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { attemptId } = req.params;

      const result = await studentService.submitTest(userId, attemptId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error submitting test:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to submit test' });
    }
  },

  // Get test result
  getTestResult: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { attemptId } = req.params;

      const result = await studentService.getTestResult(userId, attemptId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error fetching test result:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to fetch test result' });
    }
  },

  // Get attempts history
  getAttemptsHistory: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const history = await studentService.getAttemptsHistory(userId);
      res.json({ success: true, data: history });
    } catch (error) {
      console.error('Error fetching attempts history:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch attempts history' });
    }
  },

  // Get performance analytics
  getPerformanceAnalytics: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const analytics = await studentService.getPerformanceAnalytics(userId);
      res.json({ success: true, data: analytics });
    } catch (error) {
      console.error('Error fetching performance analytics:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch performance analytics' });
    }
  },

  // Get subject-wise performance
  getSubjectWisePerformance: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const performance = await studentService.getSubjectWisePerformance(userId);
      res.json({ success: true, data: performance });
    } catch (error) {
      console.error('Error fetching subject-wise performance:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch subject-wise performance' });
    }
  },

  // Get detailed analytics for a specific test attempt
  getDetailedAttemptAnalytics: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { attemptId } = req.params;
      const analytics = await studentService.getDetailedAttemptAnalytics(userId, attemptId);
      res.json({ success: true, data: analytics });
    } catch (error: any) {
      console.error('Error fetching detailed attempt analytics:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to fetch detailed analytics' });
    }
  },
};
