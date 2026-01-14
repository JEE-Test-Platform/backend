import { Response } from 'express';
import { leaderboardService } from '../services/leaderboardService';
import { AuthRequest } from '../types';

export const leaderboardController = {
  /**
   * Get leaderboard for a specific test activation
   * Accessible by: STUDENT, INSTITUTE
   */
  getTestLeaderboard: async (req: AuthRequest, res: Response) => {
    try {
      const { testActivationId } = req.params;
      const user = (req as any).user;

      if (!testActivationId) {
        return res.status(400).json({ error: 'Test activation ID is required' });
      }

      let instituteId: string;

      // Get institute ID based on user role
      if (user.role === 'STUDENT') {
        const student = await require('../utils/prisma').default.student.findUnique({
          where: { userId: user.userId },
          select: { instituteId: true },
        });

        if (!student) {
          return res.status(404).json({ error: 'Student not found' });
        }

        instituteId = student.instituteId;
      } else if (user.role === 'INSTITUTE') {
        const institute = await require('../utils/prisma').default.institute.findUnique({
          where: { userId: user.userId },
          select: { id: true },
        });

        if (!institute) {
          return res.status(404).json({ error: 'Institute not found' });
        }

        instituteId = institute.id;
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }

      const leaderboard = await leaderboardService.getTestLeaderboard(
        testActivationId,
        instituteId
      );

      res.json(leaderboard);
    } catch (error: any) {
      console.error('Error getting test leaderboard:', error);
      res.status(500).json({ error: error.message || 'Failed to get test leaderboard' });
    }
  },

  /**
   * Get student's rank for a specific test
   * Accessible by: STUDENT
   */
  getMyRank: async (req: AuthRequest, res: Response) => {
    try {
      const { testActivationId } = req.params;
      const user = (req as any).user;

      if (!testActivationId) {
        return res.status(400).json({ error: 'Test activation ID is required' });
      }

      // Get student ID
      const student = await require('../utils/prisma').default.student.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const rankInfo = await leaderboardService.getStudentRank(
        student.id,
        testActivationId
      );

      if (!rankInfo) {
        return res.status(404).json({
          error: 'No submitted attempt found for this test'
        });
      }

      res.json(rankInfo);
    } catch (error: any) {
      console.error('Error getting student rank:', error);
      res.status(500).json({ error: error.message || 'Failed to get student rank' });
    }
  },

  /**
   * Get top performers for the institute
   * Accessible by: INSTITUTE
   */
  getTopPerformers: async (req: AuthRequest, res: Response) => {
    try {
      const user = (req as any).user;
      const limit = parseInt(req.query.limit as string) || 10;

      if (user.role !== 'INSTITUTE') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const institute = await require('../utils/prisma').default.institute.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });

      if (!institute) {
        return res.status(404).json({ error: 'Institute not found' });
      }

      const topPerformers = await leaderboardService.getInstituteTopPerformers(
        institute.id,
        limit
      );

      res.json(topPerformers);
    } catch (error: any) {
      console.error('Error getting top performers:', error);
      res.status(500).json({ error: error.message || 'Failed to get top performers' });
    }
  },

  /**
   * Get leaderboard overview for institute
   * Accessible by: INSTITUTE
   */
  getLeaderboardOverview: async (req: AuthRequest, res: Response) => {
    try {
      const user = (req as any).user;

      if (user.role !== 'INSTITUTE') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const institute = await require('../utils/prisma').default.institute.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });

      if (!institute) {
        return res.status(404).json({ error: 'Institute not found' });
      }

      const overview = await leaderboardService.getInstituteLeaderboardOverview(
        institute.id
      );

      res.json(overview);
    } catch (error: any) {
      console.error('Error getting leaderboard overview:', error);
      res.status(500).json({ error: error.message || 'Failed to get leaderboard overview' });
    }
  },

  /**
   * Get student's rank in a specific test (for institute to view)
   * Accessible by: INSTITUTE
   */
  getStudentRankForInstitute: async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, testActivationId } = req.params;
      const user = (req as any).user;

      if (user.role !== 'INSTITUTE') {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!studentId || !testActivationId) {
        return res.status(400).json({
          error: 'Student ID and Test activation ID are required'
        });
      }

      const institute = await require('../utils/prisma').default.institute.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });

      if (!institute) {
        return res.status(404).json({ error: 'Institute not found' });
      }

      // Verify student belongs to institute
      const student = await require('../utils/prisma').default.student.findFirst({
        where: {
          id: studentId,
          instituteId: institute.id,
        },
      });

      if (!student) {
        return res.status(404).json({
          error: 'Student not found or does not belong to this institute'
        });
      }

      const rankInfo = await leaderboardService.getStudentRank(
        studentId,
        testActivationId
      );

      if (!rankInfo) {
        return res.status(404).json({
          error: 'No submitted attempt found for this test'
        });
      }

      res.json(rankInfo);
    } catch (error: any) {
      console.error('Error getting student rank for institute:', error);
      res.status(500).json({ error: error.message || 'Failed to get student rank' });
    }
  },
};
