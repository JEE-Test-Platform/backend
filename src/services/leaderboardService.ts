import prisma from '../utils/prisma';

interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  timeSpent: number;
  submittedAt: Date;
  attemptId: string;
}

interface LeaderboardStats {
  totalParticipants: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

export const leaderboardService = {
  /**
   * Get leaderboard for a specific test activation
   * Ranks are calculated based on:
   * 1. Highest marks obtained
   * 2. In case of tie, least time spent
   */
  getTestLeaderboard: async (testActivationId: string, instituteId: string) => {
    // Verify the test activation belongs to the institute
    const testActivation = await prisma.instituteTestActivation.findFirst({
      where: {
        id: testActivationId,
        instituteId: instituteId,
      },
      include: {
        masterTest: {
          select: {
            title: true,
            testType: true,
            totalMarks: true,
            duration: true,
          },
        },
      },
    });

    if (!testActivation) {
      throw new Error('Test activation not found or does not belong to this institute');
    }

    // Get all submitted attempts for this test activation
    const attempts = await prisma.testAttempt.findMany({
      where: {
        testActivationId: testActivationId,
        status: 'SUBMITTED',
        obtainedMarks: { not: null },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userId: true,
          },
        },
      },
      orderBy: [
        { obtainedMarks: 'desc' },
        { timeSpent: 'asc' },
        { submittedAt: 'asc' },
      ],
    });

    // Calculate ranks (handle ties - same marks and time = same rank)
    const leaderboard: LeaderboardEntry[] = [];
    let currentRank = 1;
    let previousMarks = null;
    let previousTime = null;
    let studentsWithSameRank = 0;
    const rankUpdates: { id: string; rank: number }[] = [];

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];

      // Check if this is a tie with previous entry
      if (
        previousMarks !== null &&
        attempt.obtainedMarks === previousMarks &&
        attempt.timeSpent === previousTime
      ) {
        // Same rank as previous
        studentsWithSameRank++;
      } else {
        // New rank
        currentRank = i + 1;
        studentsWithSameRank = 0;
      }

      leaderboard.push({
        rank: currentRank,
        studentId: attempt.student.id,
        studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
        obtainedMarks: attempt.obtainedMarks || 0,
        totalMarks: attempt.totalMarks || 0,
        percentage: attempt.percentage || 0,
        timeSpent: attempt.timeSpent || 0,
        submittedAt: attempt.submittedAt || attempt.createdAt,
        attemptId: attempt.id,
      });

      previousMarks = attempt.obtainedMarks;
      previousTime = attempt.timeSpent;

      if (attempt.rank !== currentRank) {
        rankUpdates.push({ id: attempt.id, rank: currentRank });
      }
    }

    // Batch all rank updates in a single transaction instead of N sequential queries
    if (rankUpdates.length > 0) {
      await prisma.$transaction(
        rankUpdates.map(({ id, rank }) =>
          prisma.testAttempt.update({ where: { id }, data: { rank } })
        )
      );
    }

    // Calculate statistics
    const stats: LeaderboardStats = {
      totalParticipants: attempts.length,
      averageScore: attempts.length > 0
        ? attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length
        : 0,
      highestScore: attempts.length > 0 ? (attempts[0].percentage || 0) : 0,
      lowestScore: attempts.length > 0 
        ? (attempts[attempts.length - 1].percentage || 0) 
        : 0,
    };

    return {
      testInfo: {
        title: testActivation.masterTest.title,
        testType: testActivation.masterTest.testType,
        totalMarks: testActivation.masterTest.totalMarks,
        duration: testActivation.masterTest.duration,
        activationDate: testActivation.activationDate,
        expiryDate: testActivation.expiryDate,
      },
      leaderboard,
      stats,
    };
  },

  /**
   * Get student's rank and position for a specific test
   */
  getStudentRank: async (studentId: string, testActivationId: string) => {
    // Get student's best attempt for this test
    const studentAttempt = await prisma.testAttempt.findFirst({
      where: {
        studentId: studentId,
        testActivationId: testActivationId,
        status: 'SUBMITTED',
      },
      orderBy: [
        { obtainedMarks: 'desc' },
        { timeSpent: 'asc' },
      ],
      include: {
        testActivation: {
          include: {
            masterTest: {
              select: {
                title: true,
                testType: true,
              },
            },
          },
        },
      },
    });

    if (!studentAttempt) {
      return null;
    }

    // Get total participants
    const totalParticipants = await prisma.testAttempt.count({
      where: {
        testActivationId: testActivationId,
        status: 'SUBMITTED',
      },
    });

    // Get students who scored better
    const betterScores = await prisma.testAttempt.count({
      where: {
        testActivationId: testActivationId,
        status: 'SUBMITTED',
        OR: [
          { obtainedMarks: { gt: studentAttempt.obtainedMarks } },
          {
            obtainedMarks: studentAttempt.obtainedMarks,
            timeSpent: { lt: studentAttempt.timeSpent },
          },
        ],
      },
    });

    const rank = betterScores + 1;

    // Update rank in database if needed
    if (studentAttempt.rank !== rank) {
      await prisma.testAttempt.update({
        where: { id: studentAttempt.id },
        data: { rank },
      });
    }

    return {
      rank,
      totalParticipants,
      obtainedMarks: studentAttempt.obtainedMarks,
      totalMarks: studentAttempt.totalMarks,
      percentage: studentAttempt.percentage,
      timeSpent: studentAttempt.timeSpent,
      submittedAt: studentAttempt.submittedAt,
      testTitle: studentAttempt.testActivation.masterTest.title,
      testType: studentAttempt.testActivation.masterTest.testType,
      percentile: totalParticipants > 0 
        ? ((totalParticipants - rank + 1) / totalParticipants) * 100 
        : 0,
    };
  },

  /**
   * Get top performers for an institute across all tests
   */
  getInstituteTopPerformers: async (instituteId: string, limit: number = 10) => {
    // Get all students in the institute with their average performance
    const students = await prisma.student.findMany({
      where: { instituteId },
      include: {
        testAttempts: {
          where: {
            status: 'SUBMITTED',
            percentage: { not: null },
          },
          select: {
            percentage: true,
            obtainedMarks: true,
            totalMarks: true,
            rank: true,
            testActivation: {
              select: {
                masterTest: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate average performance for each student
    const studentPerformances = students
      .map(student => {
        const attempts = student.testAttempts;
        if (attempts.length === 0) return null;

        const avgPercentage = attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length;
        const totalTests = attempts.length;
        const avgRank = attempts.filter(a => a.rank).reduce((sum, a) => sum + (a.rank || 0), 0) / attempts.filter(a => a.rank).length || 0;

        return {
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          averagePercentage: avgPercentage,
          totalTestsAttempted: totalTests,
          averageRank: avgRank,
        };
      })
      .filter(s => s !== null)
      .sort((a, b) => b!.averagePercentage - a!.averagePercentage)
      .slice(0, limit);

    return studentPerformances;
  },

  /**
   * Get leaderboard for multiple tests (institute overview)
   */
  getInstituteLeaderboardOverview: async (instituteId: string) => {
    // Get recent test activations
    const recentActivations = await prisma.instituteTestActivation.findMany({
      where: {
        instituteId,
        isActive: true,
      },
      include: {
        masterTest: {
          select: {
            title: true,
            testType: true,
            totalMarks: true,
          },
        },
        attempts: {
          where: {
            status: 'SUBMITTED',
          },
          orderBy: [
            { obtainedMarks: 'desc' },
            { timeSpent: 'asc' },
          ],
          take: 5,
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return recentActivations.map(activation => ({
      testActivationId: activation.id,
      testTitle: activation.masterTest.title,
      testType: activation.masterTest.testType,
      totalMarks: activation.masterTest.totalMarks,
      activationDate: activation.activationDate,
      expiryDate: activation.expiryDate,
      totalParticipants: activation.attempts.length,
      topPerformers: activation.attempts.slice(0, 3).map((attempt, index) => ({
        rank: index + 1,
        studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
        obtainedMarks: attempt.obtainedMarks,
        percentage: attempt.percentage,
      })),
    }));
  },
};
