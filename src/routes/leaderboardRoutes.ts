import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { leaderboardController } from '../controllers/leaderboardController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get test leaderboard - accessible by STUDENT and INSTITUTE
router.get(
  '/test/:testActivationId',
  authorize(Role.STUDENT, Role.INSTITUTE),
  leaderboardController.getTestLeaderboard
);

// Get my rank for a specific test - STUDENT only
router.get(
  '/test/:testActivationId/my-rank',
  authorize(Role.STUDENT),
  leaderboardController.getMyRank
);

// Get top performers - INSTITUTE only
router.get(
  '/top-performers',
  authorize(Role.INSTITUTE),
  leaderboardController.getTopPerformers
);

// Get leaderboard overview - INSTITUTE only
router.get(
  '/overview',
  authorize(Role.INSTITUTE),
  leaderboardController.getLeaderboardOverview
);

// Get specific student's rank - INSTITUTE only
router.get(
  '/student/:studentId/test/:testActivationId',
  authorize(Role.INSTITUTE),
  leaderboardController.getStudentRankForInstitute
);

export default router;
