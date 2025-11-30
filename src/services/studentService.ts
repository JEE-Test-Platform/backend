import  prisma  from '../utils/prisma';

export const studentService = {
  // Get student dashboard overview
  getDashboard: async (userId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        institute: {
          select: {
            instituteName: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Get counts
    const [availableTestsCount, completedTestsCount, inProgressCount] = await Promise.all([
      prisma.instituteTestActivation.count({
        where: {
          instituteId: student.instituteId,
          isActive: true,
          activationDate: { lte: new Date() },
          expiryDate: { gte: new Date() },
        },
      }),
      prisma.testAttempt.count({
        where: {
          studentId: student.id,
          status: 'SUBMITTED',
        },
      }),
      prisma.testAttempt.count({
        where: {
          studentId: student.id,
          status: 'IN_PROGRESS',
        },
      }),
    ]);

    // Get recent attempts
    const recentAttempts = await prisma.testAttempt.findMany({
      where: {
        studentId: student.id,
        status: 'SUBMITTED',
      },
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
      orderBy: { submittedAt: 'desc' },
      take: 5,
    });

    // Calculate average score
    const avgScore = recentAttempts.length > 0
      ? recentAttempts.reduce((acc, attempt) => acc + (attempt.percentage || 0), 0) / recentAttempts.length
      : 0;

    return {
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        institute: student.institute,
      },
      stats: {
        availableTests: availableTestsCount,
        completedTests: completedTestsCount,
        inProgressTests: inProgressCount,
        averageScore: Math.round(avgScore * 100) / 100,
      },
      recentAttempts: recentAttempts.map(attempt => ({
        id: attempt.id,
        testTitle: attempt.testActivation.masterTest.title,
        testType: attempt.testActivation.masterTest.testType,
        obtainedMarks: attempt.obtainedMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        rank: attempt.rank,
        submittedAt: attempt.submittedAt,
      })),
    };
  },

  // Get available tests
  getAvailableTests: async (userId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const now = new Date();

    const activations = await prisma.instituteTestActivation.findMany({
      where: {
        instituteId: student.instituteId,
        isActive: true,
        activationDate: { lte: now },
        expiryDate: { gte: now },
      },
      include: {
        masterTest: {
          select: {
            id: true,
            title: true,
            description: true,
            testType: true,
            duration: true,
            totalMarks: true,
            passingMarks: true,
            instructions: true,
            _count: {
              select: {
                questions: true,
              },
            },
          },
        },
        _count: {
          select: {
            attempts: {
              where: {
                studentId: student.id,
              },
            },
          },
        },
        attempts: {
          where: {
            studentId: student.id,
          },
          orderBy: {
            attemptNumber: 'desc',
          },
          take: 1,
        },
      },
      orderBy: { activationDate: 'desc' },
    });

    return activations.map(activation => ({
      activationId: activation.id,
      test: activation.masterTest,
      questionCount: activation.masterTest._count.questions,
      activationDate: activation.activationDate,
      expiryDate: activation.expiryDate,
      startTime: activation.startTime,
      endTime: activation.endTime,
      maxAttempts: activation.maxAttempts,
      attemptsUsed: activation._count.attempts,
      lastAttempt: activation.attempts[0] || null,
      canAttempt: activation._count.attempts < activation.maxAttempts,
    }));
  },

  // Get upcoming tests
  getUpcomingTests: async (userId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const now = new Date();

    const activations = await prisma.instituteTestActivation.findMany({
      where: {
        instituteId: student.instituteId,
        isActive: true,
        activationDate: { gt: now },
      },
      include: {
        masterTest: {
          select: {
            id: true,
            title: true,
            description: true,
            testType: true,
            duration: true,
            totalMarks: true,
            passingMarks: true,
            _count: {
              select: {
                questions: true,
              },
            },
          },
        },
      },
      orderBy: { activationDate: 'asc' },
    });

    return activations.map(activation => ({
      activationId: activation.id,
      test: activation.masterTest,
      questionCount: activation.masterTest._count.questions,
      activationDate: activation.activationDate,
      expiryDate: activation.expiryDate,
      startTime: activation.startTime,
      endTime: activation.endTime,
      maxAttempts: activation.maxAttempts,
    }));
  },

  // Get completed tests
  getCompletedTests: async (userId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempts = await prisma.testAttempt.findMany({
      where: {
        studentId: student.id,
        status: 'SUBMITTED',
      },
      include: {
        testActivation: {
          include: {
            masterTest: {
              select: {
                id: true,
                title: true,
                description: true,
                testType: true,
                duration: true,
                totalMarks: true,
                passingMarks: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return attempts.map(attempt => ({
      attemptId: attempt.id,
      test: attempt.testActivation.masterTest,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeSpent: attempt.timeSpent,
      obtainedMarks: attempt.obtainedMarks,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      isPassed: attempt.isPassed,
      rank: attempt.rank,
    }));
  },

  // Start a new test attempt
  startTest: async (userId: string, testActivationId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Get test activation
    const activation = await prisma.instituteTestActivation.findUnique({
      where: { id: testActivationId },
      include: {
        masterTest: {
          include: {
            questions: {
              include: {
                options: true,
              },
              orderBy: { questionOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!activation) {
      throw new Error('Test activation not found');
    }

    // Verify student belongs to the institute
    if (activation.instituteId !== student.instituteId) {
      throw new Error('Unauthorized to access this test');
    }

    // Check if test is active
    const now = new Date();
    if (!activation.isActive || activation.activationDate > now || activation.expiryDate < now) {
      throw new Error('Test is not currently available');
    }

    // Check if student has reached max attempts
    const attemptCount = await prisma.testAttempt.count({
      where: {
        studentId: student.id,
        testActivationId: activation.id,
      },
    });

    if (attemptCount >= activation.maxAttempts) {
      throw new Error('Maximum attempts reached for this test');
    }

    // Check for existing IN_PROGRESS attempt
    const existingAttempt = await prisma.testAttempt.findFirst({
      where: {
        studentId: student.id,
        testActivationId: activation.id,
        status: 'IN_PROGRESS',
      },
    });

    if (existingAttempt) {
      // Return existing attempt
      const questions = await prisma.question.findMany({
        where: { masterTestId: activation.masterTest.id },
        include: {
          options: true,
        },
        orderBy: { questionOrder: 'asc' },
      });

      const answers = await prisma.studentAnswer.findMany({
        where: { attemptId: existingAttempt.id },
      });

      return {
        attempt: existingAttempt,
        test: activation.masterTest,
        questions: questions.map(q => ({
          ...q,
          correctAnswer: undefined, // Hide correct answer during attempt
          explanation: undefined, // Hide explanation during attempt
        })),
        answers,
      };
    }

    // Create new attempt
    const attempt = await prisma.testAttempt.create({
      data: {
        studentId: student.id,
        testActivationId: activation.id,
        attemptNumber: attemptCount + 1,
        totalMarks: activation.masterTest.totalMarks,
        status: 'IN_PROGRESS',
      },
    });

    // Return attempt with questions (hide answers and explanations)
    return {
      attempt,
      test: activation.masterTest,
      questions: activation.masterTest.questions.map(q => ({
        ...q,
        correctAnswer: undefined,
        explanation: undefined,
      })),
      answers: [],
    };
  },

  // Get current test attempt
  getTestAttempt: async (userId: string, attemptId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        testActivation: {
          include: {
            masterTest: {
              include: {
                questions: {
                  include: {
                    options: true,
                  },
                  orderBy: { questionOrder: 'asc' },
                },
              },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      throw new Error('Test attempt not found');
    }

    if (attempt.studentId !== student.id) {
      throw new Error('Unauthorized to access this attempt');
    }

    // Hide correct answers and explanations if test is still in progress
    const questions = attempt.testActivation.masterTest.questions.map(q => ({
      ...q,
      correctAnswer: attempt.status === 'SUBMITTED' ? q.correctAnswer : undefined,
      explanation: attempt.status === 'SUBMITTED' ? q.explanation : undefined,
    }));

    return {
      attempt,
      test: attempt.testActivation.masterTest,
      questions,
      answers: attempt.answers,
    };
  },

  // Save answer
  saveAnswer: async (
    userId: string,
    attemptId: string,
    questionId: string,
    selectedAnswer: string,
    timeSpent?: number
  ) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      throw new Error('Test attempt not found');
    }

    if (attempt.studentId !== student.id) {
      throw new Error('Unauthorized to access this attempt');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new Error('Test is not in progress');
    }

    // Upsert answer
    const answer = await prisma.studentAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
      update: {
        selectedAnswer,
        timeSpent,
        updatedAt: new Date(),
      },
      create: {
        attemptId,
        questionId,
        selectedAnswer,
        timeSpent,
      },
    });

    return answer;
  },

  // Mark question for review (stored in frontend state, not persisted)
  markForReview: async (userId: string, attemptId: string, questionId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt || attempt.studentId !== student.id) {
      throw new Error('Unauthorized access');
    }

    // Just verify the question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    return { success: true, message: 'Marked for review' };
  },

  // Submit test
  submitTest: async (userId: string, attemptId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        testActivation: {
          include: {
            masterTest: {
              include: {
                questions: {
                  include: {
                    options: true,
                  },
                },
              },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      throw new Error('Test attempt not found');
    }

    if (attempt.studentId !== student.id) {
      throw new Error('Unauthorized to access this attempt');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new Error('Test is not in progress');
    }

    // Calculate scores
    let obtainedMarks = 0;
    const questions = attempt.testActivation.masterTest.questions;

    for (const answer of attempt.answers) {
      const question = questions.find(q => q.id === answer.questionId);
      if (!question) continue;

      let isCorrect = false;
      let marksObtained = 0;

      if (question.questionType === 'MCQ') {
        // Find the correct option
        const correctOption = question.options.find(o => o.isCorrect);
        isCorrect = answer.selectedAnswer === correctOption?.optionLabel;
        marksObtained = isCorrect ? question.marks : 0;
      } else if (question.questionType === 'NUMERICAL' || question.questionType === 'TRUE_FALSE') {
        isCorrect = answer.selectedAnswer?.toLowerCase() === question.correctAnswer.toLowerCase();
        marksObtained = isCorrect ? question.marks : 0;
      }

      obtainedMarks += marksObtained;

      // Update answer with evaluation
      await prisma.studentAnswer.update({
        where: { id: answer.id },
        data: {
          isCorrect,
          marksObtained,
        },
      });
    }

    const totalMarks = attempt.testActivation.masterTest.totalMarks;
    const percentage = (obtainedMarks / totalMarks) * 100;
    const isPassed = obtainedMarks >= attempt.testActivation.masterTest.passingMarks;
    const timeSpent = Math.floor((new Date().getTime() - attempt.startedAt.getTime()) / 1000 / 60); // in minutes

    // Update attempt
    const submittedAttempt = await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        obtainedMarks,
        percentage,
        isPassed,
        timeSpent,
      },
    });

    // Calculate rank
    const betterAttempts = await prisma.testAttempt.count({
      where: {
        testActivationId: attempt.testActivationId,
        status: 'SUBMITTED',
        OR: [
          { obtainedMarks: { gt: obtainedMarks } },
          {
            obtainedMarks,
            timeSpent: { lt: timeSpent },
          },
        ],
      },
    });

    const rank = betterAttempts + 1;

    // Update rank
    await prisma.testAttempt.update({
      where: { id: attemptId },
      data: { rank },
    });

    return {
      ...submittedAttempt,
      rank,
    };
  },

  // Get test result
  getTestResult: async (userId: string, attemptId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        testActivation: {
          include: {
            masterTest: {
              include: {
                questions: {
                  include: {
                    options: true,
                  },
                  orderBy: { questionOrder: 'asc' },
                },
              },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt || attempt.studentId !== student.id) {
      throw new Error('Unauthorized access');
    }

    if (attempt.status !== 'SUBMITTED') {
      throw new Error('Test has not been submitted yet');
    }

    // Calculate subject-wise performance
    const subjectPerformance: any = {};
    const difficultyPerformance: any = {};

    for (const question of attempt.testActivation.masterTest.questions) {
      const answer = attempt.answers.find(a => a.questionId === question.id);
      const subject = question.subject;
      const difficulty = question.difficulty;

      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = { correct: 0, total: 0, marks: 0, totalMarks: 0 };
      }
      if (!difficultyPerformance[difficulty]) {
        difficultyPerformance[difficulty] = { correct: 0, total: 0 };
      }

      subjectPerformance[subject].total++;
      subjectPerformance[subject].totalMarks += question.marks;
      difficultyPerformance[difficulty].total++;

      if (answer?.isCorrect) {
        subjectPerformance[subject].correct++;
        subjectPerformance[subject].marks += answer.marksObtained || 0;
        difficultyPerformance[difficulty].correct++;
      }
    }

    return {
      attempt: {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeSpent: attempt.timeSpent,
        obtainedMarks: attempt.obtainedMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        rank: attempt.rank,
      },
      test: {
        title: attempt.testActivation.masterTest.title,
        testType: attempt.testActivation.masterTest.testType,
        totalMarks: attempt.testActivation.masterTest.totalMarks,
        passingMarks: attempt.testActivation.masterTest.passingMarks,
      },
      questions: attempt.testActivation.masterTest.questions,
      answers: attempt.answers,
      subjectPerformance,
      difficultyPerformance,
    };
  },

  // Get attempts history
  getAttemptsHistory: async (userId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempts = await prisma.testAttempt.findMany({
      where: {
        studentId: student.id,
        status: 'SUBMITTED',
      },
      include: {
        testActivation: {
          include: {
            masterTest: {
              select: {
                title: true,
                testType: true,
                totalMarks: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return attempts.map(attempt => ({
      id: attempt.id,
      testTitle: attempt.testActivation.masterTest.title,
      testType: attempt.testActivation.masterTest.testType,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt,
      obtainedMarks: attempt.obtainedMarks,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      rank: attempt.rank,
      isPassed: attempt.isPassed,
    }));
  },

  // Get performance analytics
  getPerformanceAnalytics: async (userId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempts = await prisma.testAttempt.findMany({
      where: {
        studentId: student.id,
        status: 'SUBMITTED',
      },
      include: {
        testActivation: {
          include: {
            masterTest: true,
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // Score trend
    const scoreTrend = attempts.map(attempt => ({
      date: attempt.submittedAt,
      testTitle: attempt.testActivation.masterTest.title,
      percentage: attempt.percentage,
      obtainedMarks: attempt.obtainedMarks,
      totalMarks: attempt.totalMarks,
    }));

    // Calculate averages
    const avgPercentage = attempts.length > 0
      ? attempts.reduce((acc, a) => acc + (a.percentage || 0), 0) / attempts.length
      : 0;

    const avgRank = attempts.length > 0
      ? attempts.reduce((acc, a) => acc + (a.rank || 0), 0) / attempts.length
      : 0;

    // Test type performance
    const testTypePerformance: any = {};
    attempts.forEach(attempt => {
      const testType = attempt.testActivation.masterTest.testType;
      if (!testTypePerformance[testType]) {
        testTypePerformance[testType] = { count: 0, totalPercentage: 0, avgPercentage: 0 };
      }
      testTypePerformance[testType].count++;
      testTypePerformance[testType].totalPercentage += attempt.percentage || 0;
    });

    Object.keys(testTypePerformance).forEach(type => {
      const data = testTypePerformance[type];
      data.avgPercentage = data.totalPercentage / data.count;
    });

    return {
      totalAttempts: attempts.length,
      avgPercentage: Math.round(avgPercentage * 100) / 100,
      avgRank: Math.round(avgRank),
      scoreTrend,
      testTypePerformance,
    };
  },

  // Get subject-wise performance
  getSubjectWisePerformance: async (userId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempts = await prisma.testAttempt.findMany({
      where: {
        studentId: student.id,
        status: 'SUBMITTED',
      },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    const subjectStats: any = {
      PHYSICS: { correct: 0, total: 0, percentage: 0 },
      CHEMISTRY: { correct: 0, total: 0, percentage: 0 },
      MATHEMATICS: { correct: 0, total: 0, percentage: 0 },
    };

    attempts.forEach(attempt => {
      attempt.answers.forEach(answer => {
        const subject = answer.question.subject;
        if (subjectStats[subject]) {
          subjectStats[subject].total++;
          if (answer.isCorrect) {
            subjectStats[subject].correct++;
          }
        }
      });
    });

    Object.keys(subjectStats).forEach(subject => {
      const stats = subjectStats[subject];
      stats.percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    });

    return subjectStats;
  },

  // Get student's rank for a specific test
  getTestRank: async (userId: string, testActivationId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Import leaderboard service
    const { leaderboardService } = require('./leaderboardService');
    
    return await leaderboardService.getStudentRank(student.id, testActivationId);
  },

  // Get all tests with student's rank
  getTestsWithRanks: async (userId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const attempts = await prisma.testAttempt.findMany({
      where: {
        studentId: student.id,
        status: 'SUBMITTED',
      },
      include: {
        testActivation: {
          include: {
            masterTest: {
              select: {
                title: true,
                testType: true,
                totalMarks: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return attempts.map(attempt => ({
      testActivationId: attempt.testActivationId,
      attemptId: attempt.id,
      testTitle: attempt.testActivation.masterTest.title,
      testType: attempt.testActivation.masterTest.testType,
      obtainedMarks: attempt.obtainedMarks,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      rank: attempt.rank,
      submittedAt: attempt.submittedAt,
    }));
  },
};

