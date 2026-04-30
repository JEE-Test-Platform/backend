import prisma from '../utils/prisma';
import { testExpiryQueue } from '../lib/queue';
import { clearTimerInterval } from '../socket/timerSocket';

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

    const allActivations = await prisma.instituteTestActivation.findMany({
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

    // If startTime is set, only show the test once that time has been reached
    const activations = allActivations.filter(a => !a.startTime || a.startTime <= now);

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

    // Only fetch the fields needed to validate and create the attempt — questions are
    // loaded separately by the client via GET /attempts/:id so we don't block navigation
    const activation = await prisma.instituteTestActivation.findUnique({
      where: { id: testActivationId },
      include: {
        masterTest: {
          select: {
            id: true,
            duration: true,
            totalMarks: true,
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
    const effectiveStart = activation.startTime ?? activation.activationDate;
    if (!activation.isActive || effectiveStart > now || activation.expiryDate < now) {
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
      // Re-schedule expiry job if not already queued (idempotent via jobId)
      const durationMs = activation.masterTest.duration * 60 * 1000;
      const elapsedMs = Date.now() - existingAttempt.startedAt.getTime();
      const delay = Math.max(0, durationMs - elapsedMs);
      testExpiryQueue.add(
        'auto-submit',
        { attemptId: existingAttempt.id },
        { delay, jobId: `auto-submit-${existingAttempt.id}` }
      ).catch(err => console.error('[Queue] Failed to schedule expiry job:', err));

      // Return only the attempt ID — client fetches questions via GET /attempts/:id
      return { attempt: existingAttempt };
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

    // Schedule BullMQ job to auto-submit when time expires
    const durationMs = activation.masterTest.duration * 60 * 1000;
    testExpiryQueue.add(
      'auto-submit',
      { attemptId: attempt.id },
      { delay: durationMs, jobId: `auto-submit-${attempt.id}` }
    ).catch(err => console.error('[Queue] Failed to schedule expiry job:', err));

    // Return only the attempt ID — client fetches questions via GET /attempts/:id
    return { attempt };
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
              select: {
                id: true,
                title: true,
                testType: true,
                duration: true,
                totalMarks: true,
                passingMarks: true,
                instructions: true,
                questions: {
                  select: {
                    id: true,
                    questionText: true,
                    questionType: true,
                    questionOrder: true,
                    subject: true,
                    difficulty: true,
                    nature: true,
                    marks: true,
                    negativeMarks: true,
                    partialMarking: true,
                    imageUrl: true,
                    passageText: true,
                    parentQuestionId: true,
                    columnIItems: true,
                    columnIIItems: true,
                    correctMatches: true,
                    matchRows: true,
                    options: {
                      select: {
                        id: true,
                        optionLabel: true,
                        optionText: true,
                        optionImageUrl: true,
                      },
                    },
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

    return {
      attempt,
      test: attempt.testActivation.masterTest,
      questions: attempt.testActivation.masterTest.questions,
      answers: attempt.answers,
    };
  },

  // Save answer
  saveAnswer: async (
    userId: string,
    attemptId: string,
    questionId: string,
    selectedAnswer: string | null,
    selectedAnswers: any[] | null,
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

    // Check if answer already exists to handle time accumulation
    const existingAnswer = await prisma.studentAnswer.findUnique({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
    });

    // The frontend now sends cumulative time, so we just use it directly
    // But if for some reason we get a smaller value, we keep the larger one
    const finalTimeSpent = timeSpent !== undefined
      ? Math.max(timeSpent, existingAnswer?.timeSpent || 0)
      : existingAnswer?.timeSpent;

    // Upsert answer - handle both simple and complex answer types
    const answer = await prisma.studentAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
      update: {
        selectedAnswer: selectedAnswer,
        selectedAnswers: selectedAnswers,
        timeSpent: finalTimeSpent,
        updatedAt: new Date(),
      },
      create: {
        attemptId,
        questionId,
        selectedAnswer: selectedAnswer,
        selectedAnswers: selectedAnswers,
        timeSpent: timeSpent || 0,
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

    // Minimal select — only fields needed for scoring
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        testActivation: {
          select: {
            id: true,
            masterTest: {
              select: {
                totalMarks: true,
                passingMarks: true,
                questions: {
                  select: {
                    id: true,
                    questionType: true,
                    marks: true,
                    correctAnswer: true,
                    partialMarking: true,
                    options: {
                      select: { optionLabel: true, isCorrect: true },
                    },
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

    // Idempotent: if already submitted (e.g. double-click), return existing result
    if (attempt.status === 'SUBMITTED' || attempt.status === 'EXPIRED') {
      return { attemptId, status: attempt.status, alreadySubmitted: true };
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new Error('Test is not in progress');
    }

    // Calculate scores
    let obtainedMarks = 0;
    const questions = attempt.testActivation.masterTest.questions;
    const answerUpdates: { id: string; isCorrect: boolean; marksObtained: number }[] = [];

    for (const answer of attempt.answers) {
      const question = questions.find(q => q.id === answer.questionId);
      if (!question) continue;

      let isCorrect = false;
      let marksObtained = 0;

      switch (question.questionType) {
        case 'MCQ':
        case 'COMPREHENSION_SUB': {
          // Find the correct option
          const correctOption = question.options.find(o => o.isCorrect);
          isCorrect = answer.selectedAnswer === correctOption?.optionLabel;
          marksObtained = isCorrect ? question.marks : 0;
          break;
        }
        case 'MCQ_MULTIPLE': {
          // Get all correct options
          const correctOptions = question.options.filter(o => o.isCorrect).map(o => o.optionLabel).sort();
          const studentAnswers = ((answer.selectedAnswers as string[]) || []).sort();

          // Check if all answers match
          const allCorrect = correctOptions.length === studentAnswers.length &&
            correctOptions.every((opt, idx) => opt === studentAnswers[idx]);

          if (allCorrect) {
            isCorrect = true;
            marksObtained = question.marks;
          } else if (question.partialMarking && studentAnswers.length > 0) {
            // Partial marking: Give credit for each correct selection and deduct for wrong ones
            const correctSelected = studentAnswers.filter(ans => correctOptions.includes(ans)).length;
            const incorrectSelected = studentAnswers.filter(ans => !correctOptions.includes(ans)).length;
            const netCorrect = correctSelected - incorrectSelected;

            if (netCorrect > 0) {
              marksObtained = (netCorrect / correctOptions.length) * question.marks;
            } else {
              marksObtained = 0;
            }
            isCorrect = false; // Partial credit, not fully correct
          } else {
            isCorrect = false;
            marksObtained = 0;
          }
          break;
        }
        case 'MATCH_FOLLOWING': {
          // JEE Main format - Treat as regular MCQ with coded answers
          isCorrect = answer.selectedAnswer === question.correctAnswer;
          marksObtained = isCorrect ? question.marks : 0;
          break;
        }
        case 'NUMERICAL':
        case 'TRUE_FALSE': {
          isCorrect = answer.selectedAnswer?.toLowerCase() === question.correctAnswer?.toLowerCase();
          marksObtained = isCorrect ? question.marks : 0;
          break;
        }
        case 'COMPREHENSION': {
          // Comprehension parent questions don't have answers
          break;
        }
      }

      obtainedMarks += marksObtained;
      answerUpdates.push({ id: answer.id, isCorrect, marksObtained });
    }

    // Single UPDATE with CASE WHEN — avoids N round-trips for N answers
    if (answerUpdates.length > 0) {
      const isCorrectCase = answerUpdates
        .map(u => `WHEN id = '${u.id}' THEN ${u.isCorrect}`)
        .join(' ');
      const marksCase = answerUpdates
        .map(u => `WHEN id = '${u.id}' THEN ${u.marksObtained}`)
        .join(' ');
      const idList = answerUpdates.map(u => `'${u.id}'`).join(', ');
      await prisma.$executeRawUnsafe(`
        UPDATE student_answers
        SET "isCorrect" = CASE ${isCorrectCase} ELSE "isCorrect" END,
            "marksObtained" = CASE ${marksCase} ELSE "marksObtained" END
        WHERE id IN (${idList})
      `);
    }

    const totalMarks = attempt.testActivation.masterTest.totalMarks;
    const percentage = (obtainedMarks / totalMarks) * 100;
    const timeSpent = Math.floor((new Date().getTime() - attempt.startedAt.getTime()) / 1000 / 60);

    // Update attempt
    const submittedAttempt = await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        obtainedMarks,
        percentage,
        timeSpent,
      },
    });

    // Recalculate ALL ranks for this activation atomically via SQL window function.
    // This avoids the race condition where two concurrent submissions both count each
    // other as "not yet submitted" and end up with duplicate ranks.
    await prisma.$executeRaw`
      UPDATE test_attempts
      SET rank = subq.rn
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY "testActivationId"
                 ORDER BY "obtainedMarks" DESC NULLS LAST, "timeSpent" ASC NULLS LAST, "submittedAt" ASC NULLS LAST
               ) AS rn
        FROM test_attempts
        WHERE "testActivationId" = ${attempt.testActivationId}
          AND status = 'SUBMITTED'
      ) subq
      WHERE test_attempts.id = subq.id
    `;

    // Read back this attempt's rank
    const updatedAttempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: { rank: true },
    });
    const rank = updatedAttempt?.rank ?? null;

    // Cancel the BullMQ auto-submit job (student submitted early)
    try {
      const expiryJob = await testExpiryQueue.getJob(`auto-submit-${attemptId}`);
      if (expiryJob) await expiryJob.remove();
    } catch (err) {
      console.error('[Queue] Failed to remove expiry job:', err);
    }

    // Stop the Socket.io timer interval for this attempt
    clearTimerInterval(attemptId);

    // Enqueue AI report generation - COMMENTED OUT FOR NOW
    // try {
    //   const { addReportJob } = require('../lib/queue');
    //   await addReportJob(attemptId);
    // } catch (error) {
    //   console.error('[AI Report] Failed to enqueue job:', error);
    // }

    return {
      ...submittedAttempt,
      rank,
    };
  },

  // Auto-submit an attempt when time expires (called by BullMQ worker)
  autoSubmitExpiredTest: async (attemptId: string) => {
    // Minimal select — only fields needed for scoring
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        testActivation: {
          select: {
            id: true,
            masterTest: {
              select: {
                totalMarks: true,
                passingMarks: true,
                questions: {
                  select: {
                    id: true,
                    questionType: true,
                    marks: true,
                    correctAnswer: true,
                    partialMarking: true,
                    options: {
                      select: { optionLabel: true, isCorrect: true },
                    },
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
      console.warn(`[Expiry] Attempt ${attemptId} not found`);
      return;
    }

    // Skip if already submitted (student submitted before the job fired)
    if (attempt.status !== 'IN_PROGRESS') {
      console.log(`[Expiry] Attempt ${attemptId} already closed (${attempt.status}), skipping`);
      return;
    }

    // --- Score the attempt (same logic as submitTest) ---
    let obtainedMarks = 0;
    const questions = attempt.testActivation.masterTest.questions;
    const autoSubmitAnswerUpdates: { id: string; isCorrect: boolean; marksObtained: number }[] = [];

    for (const answer of attempt.answers) {
      const question = questions.find(q => q.id === answer.questionId);
      if (!question) continue;

      let isCorrect = false;
      let marksObtained = 0;

      switch (question.questionType) {
        case 'MCQ':
        case 'COMPREHENSION_SUB': {
          const correctOption = question.options.find(o => o.isCorrect);
          isCorrect = answer.selectedAnswer === correctOption?.optionLabel;
          marksObtained = isCorrect ? question.marks : 0;
          break;
        }
        case 'MCQ_MULTIPLE': {
          const correctOptions = question.options.filter(o => o.isCorrect).map(o => o.optionLabel).sort();
          const studentAnswers = ((answer.selectedAnswers as string[]) || []).sort();
          const allCorrect = correctOptions.length === studentAnswers.length &&
            correctOptions.every((opt, idx) => opt === studentAnswers[idx]);
          if (allCorrect) {
            isCorrect = true;
            marksObtained = question.marks;
          } else if (question.partialMarking && studentAnswers.length > 0) {
            const correctSelected = studentAnswers.filter(ans => correctOptions.includes(ans)).length;
            const incorrectSelected = studentAnswers.filter(ans => !correctOptions.includes(ans)).length;
            const netCorrect = correctSelected - incorrectSelected;
            marksObtained = netCorrect > 0 ? (netCorrect / correctOptions.length) * question.marks : 0;
          }
          break;
        }
        case 'MATCH_FOLLOWING': {
          isCorrect = answer.selectedAnswer === question.correctAnswer;
          marksObtained = isCorrect ? question.marks : 0;
          break;
        }
        case 'NUMERICAL':
        case 'TRUE_FALSE': {
          isCorrect = answer.selectedAnswer?.toLowerCase() === question.correctAnswer?.toLowerCase();
          marksObtained = isCorrect ? question.marks : 0;
          break;
        }
      }

      obtainedMarks += marksObtained;
      autoSubmitAnswerUpdates.push({ id: answer.id, isCorrect, marksObtained });
    }

    // Single UPDATE with CASE WHEN — avoids N round-trips for N answers
    if (autoSubmitAnswerUpdates.length > 0) {
      const isCorrectCase = autoSubmitAnswerUpdates
        .map(u => `WHEN id = '${u.id}' THEN ${u.isCorrect}`)
        .join(' ');
      const marksCase = autoSubmitAnswerUpdates
        .map(u => `WHEN id = '${u.id}' THEN ${u.marksObtained}`)
        .join(' ');
      const idList = autoSubmitAnswerUpdates.map(u => `'${u.id}'`).join(', ');
      await prisma.$executeRawUnsafe(`
        UPDATE student_answers
        SET "isCorrect" = CASE ${isCorrectCase} ELSE "isCorrect" END,
            "marksObtained" = CASE ${marksCase} ELSE "marksObtained" END
        WHERE id IN (${idList})
      `);
    }

    const totalMarks = attempt.testActivation.masterTest.totalMarks;
    const percentage = (obtainedMarks / totalMarks) * 100;
    const isPassed = obtainedMarks >= attempt.testActivation.masterTest.passingMarks;
    const timeSpent = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000 / 60);

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

    // Atomic rank recalculation via SQL window function (same as submitTest)
    await prisma.$executeRaw`
      UPDATE test_attempts
      SET rank = subq.rn
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY "testActivationId"
                 ORDER BY "obtainedMarks" DESC NULLS LAST, "timeSpent" ASC NULLS LAST, "submittedAt" ASC NULLS LAST
               ) AS rn
        FROM test_attempts
        WHERE "testActivationId" = ${attempt.testActivationId}
          AND status = 'SUBMITTED'
      ) subq
      WHERE test_attempts.id = subq.id
    `;

    const updatedRankRow = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: { rank: true },
    });
    const rank = updatedRankRow?.rank ?? null;

    // Stop the Socket.io timer interval
    clearTimerInterval(attemptId);

    console.log(`[Expiry] Attempt ${attemptId} auto-submitted. Marks: ${obtainedMarks}/${totalMarks}, Rank: ${rank}`);
    return { ...submittedAttempt, rank };
  },

  // Get test result
  getTestResult: async (userId: string, attemptId: string) => {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const metrics = await studentService.getTestAttemptMetrics(attemptId);

    if (metrics.attempt.studentId !== student.id) {
      throw new Error('Unauthorized access');
    }

    return metrics;
  },

  // Internal helper to get metrics for AI/Reports without userId check
  getTestAttemptMetrics: async (attemptId: string) => {
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        testActivation: {
          include: {
            masterTest: {
              select: {
                title: true,
                testType: true,
                totalMarks: true,
                passingMarks: true,
                duration: true,
                questions: {
                  select: {
                    id: true,
                    subject: true,
                    difficulty: true,
                    nature: true,
                    marks: true,
                  },
                  orderBy: { questionOrder: 'asc' },
                },
              },
            },
          },
        },
        answers: {
          select: {
            questionId: true,
            isCorrect: true,
            marksObtained: true,
            timeSpent: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new Error('Test attempt not found');
    }

    // Calculate subject-wise performance
    const subjectPerformance: any = {};
    const difficultyPerformance: any = {};
    const naturePerformance: any = {};
    const behavioralPatterns: any = {};

    // Combined stats (Nature × Difficulty = 9 metrics)
    const combinedStats: Record<string, { correct: number; total: number }> = {};
    const natures = ['CONCEPTUAL', 'FORMULA_BASED', 'APPLICATION_BASED'];
    const difficulties = ['EASY', 'MEDIUM', 'HARD'];
    natures.forEach(n => {
      difficulties.forEach(d => {
        combinedStats[`${n}|${d}`] = { correct: 0, total: 0 };
      });
    });

    for (const question of attempt.testActivation.masterTest.questions) {
      const answer = attempt.answers.find(a => a.questionId === question.id);
      const subject = question.subject;
      const difficulty = question.difficulty;

      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = { correct: 0, total: 0, marks: 0, totalMarks: 0, totalTime: 0 };
      }
      if (!difficultyPerformance[difficulty]) {
        difficultyPerformance[difficulty] = { correct: 0, total: 0, totalTime: 0 };
      }
      const nature = (question as any).nature || 'CONCEPTUAL';
      if (!naturePerformance[nature]) {
        naturePerformance[nature] = { correct: 0, total: 0, totalTime: 0 };
      }
      if (!behavioralPatterns[subject]) {
        behavioralPatterns[subject] = {
          haste_mistakes: 0, // Easy + Wrong + Fast
          time_sinks: 0,     // Hard + Wrong + Slow
          strong_basics: 0,  // Easy + Correct + Fast
          struggling: 0,     // Easy + Wrong + Slow
          efficiency: 0      // Hard + Correct + Fast/Medium
        };
      }

      subjectPerformance[subject].total++;
      subjectPerformance[subject].totalMarks += question.marks;
      difficultyPerformance[difficulty].total++;
      naturePerformance[nature].total++;

      // Update combined stats
      const combinedKey = `${nature}|${difficulty}`;
      if (combinedStats[combinedKey]) {
        combinedStats[combinedKey].total++;
      }

      if (answer) {
        const timeSpent = answer.timeSpent || 0;
        subjectPerformance[subject].totalTime += timeSpent;
        difficultyPerformance[difficulty].totalTime += timeSpent;
        naturePerformance[nature].totalTime += timeSpent;

        if (answer.isCorrect) {
          subjectPerformance[subject].correct++;
          subjectPerformance[subject].marks += answer.marksObtained || 0;
          difficultyPerformance[difficulty].correct++;
          naturePerformance[nature].correct++;

          // Update combined stats
          if (combinedStats[combinedKey]) {
            combinedStats[combinedKey].correct++;
          }

          // Behavioral logic - Correct
          if (difficulty === 'EASY' && timeSpent < 60) {
            behavioralPatterns[subject].strong_basics++;
          } else if (difficulty === 'HARD' && timeSpent < 120) {
            behavioralPatterns[subject].efficiency++;
          }
        } else {
          // Behavioral logic - Wrong
          if (difficulty === 'EASY') {
            if (timeSpent < 45) {
              behavioralPatterns[subject].haste_mistakes++;
            } else if (timeSpent > 120) {
              behavioralPatterns[subject].struggling++;
            }
          } else if (difficulty === 'HARD' && timeSpent > 180) {
            behavioralPatterns[subject].time_sinks++;
          }
        }
      }
    }

    // Transform combined stats into array format
    const combinedPerformance = Object.entries(combinedStats).map(([key, stats]) => {
      const [nature, difficulty] = key.split('|');
      return {
        nature,
        difficulty,
        correct: stats.correct,
        total: stats.total,
        percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      };
    });

    return {
      attempt: {
        id: attempt.id,
        studentId: attempt.studentId,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeSpent: attempt.timeSpent,
        obtainedMarks: attempt.obtainedMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage ?? (attempt.totalMarks > 0 ? (attempt.obtainedMarks / attempt.totalMarks) * 100 : 0),
        rank: attempt.rank,
        status: attempt.status,
        aiAnalysisReport: attempt.aiAnalysisReport,
        analysisStatus: attempt.analysisStatus,
      },
      test: {
        title: attempt.testActivation.masterTest.title,
        testType: attempt.testActivation.masterTest.testType,
        totalMarks: attempt.testActivation.masterTest.totalMarks,
        passingMarks: attempt.testActivation.masterTest.passingMarks,
        duration: attempt.testActivation.masterTest.duration,
      },
      questions: attempt.testActivation.masterTest.questions,
      answers: attempt.answers,
      subjectPerformance,
      difficultyPerformance,
      naturePerformance,
      combinedPerformance,
      behavioralPatterns,
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
      orderBy: { submittedAt: 'desc' },
    });

    // Score trend
    const scoreTrend = attempts.map(attempt => ({
      date: attempt.submittedAt,
      testTitle: attempt.testActivation.masterTest.title,
      percentage: attempt.percentage,
      obtainedMarks: attempt.obtainedMarks,
      totalMarks: attempt.totalMarks,
      attemptId: attempt.id,
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
      select: {
        answers: {
          select: {
            isCorrect: true,
            question: { select: { subject: true } },
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

  // Get nature-wise and combined (nature × difficulty) performance
  getNatureWisePerformance: async (userId: string) => {
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
      select: {
        answers: {
          select: {
            isCorrect: true,
            question: { select: { nature: true, difficulty: true } },
          },
        },
      },
    });

    // Nature-wise stats
    const natureStats: Record<string, { correct: number; total: number; percentage: number }> = {
      CONCEPTUAL: { correct: 0, total: 0, percentage: 0 },
      FORMULA_BASED: { correct: 0, total: 0, percentage: 0 },
      APPLICATION_BASED: { correct: 0, total: 0, percentage: 0 },
    };

    // Combined stats (Nature × Difficulty = 9 metrics)
    const combinedStats: Record<string, { correct: number; total: number; percentage: number }> = {};
    const natures = ['CONCEPTUAL', 'FORMULA_BASED', 'APPLICATION_BASED'];
    const difficulties = ['EASY', 'MEDIUM', 'HARD'];

    // Initialize all 9 combinations
    natures.forEach(nature => {
      difficulties.forEach(difficulty => {
        combinedStats[`${nature}|${difficulty}`] = { correct: 0, total: 0, percentage: 0 };
      });
    });

    attempts.forEach(attempt => {
      attempt.answers.forEach(answer => {
        const question = answer.question;
        const nature = (question as any).nature || 'CONCEPTUAL';
        const difficulty = question.difficulty;

        // Update nature stats
        if (natureStats[nature]) {
          natureStats[nature].total++;
          if (answer.isCorrect) {
            natureStats[nature].correct++;
          }
        }

        // Update combined stats
        const combinedKey = `${nature}|${difficulty}`;
        if (combinedStats[combinedKey]) {
          combinedStats[combinedKey].total++;
          if (answer.isCorrect) {
            combinedStats[combinedKey].correct++;
          }
        }
      });
    });

    // Calculate percentages
    Object.keys(natureStats).forEach(nature => {
      const stats = natureStats[nature];
      stats.percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    });

    Object.keys(combinedStats).forEach(key => {
      const stats = combinedStats[key];
      stats.percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    });

    // Transform combined stats into array format for frontend
    const combinedPerformance = Object.entries(combinedStats).map(([key, stats]) => {
      const [nature, difficulty] = key.split('|');
      return {
        nature,
        difficulty,
        ...stats,
      };
    });

    return {
      natureWise: natureStats,
      combined: combinedPerformance,
    };
  },

  // Get detailed analytics for a specific test attempt
  getDetailedAttemptAnalytics: async (userId: string, attemptId: string) => {
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
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!attempt || attempt.studentId !== student.id) {
      throw new Error('Test attempt not found');
    }

    // 1. MISTAKE AND CONCEPTUAL ANALYSIS

    // 1.1 Subject/Topic-wise Accuracy
    const subjectWiseAccuracy: Record<string, { correct: number; total: number; percentage: number }> = {};

    // 1.2 Difficulty-Pacing Analysis
    const difficultyPacing: Record<string, {
      avgTimeCorrect: number;
      avgTimeIncorrect: number;
      totalCorrect: number;
      totalIncorrect: number;
      timeCorrect: number;
      timeIncorrect: number;
    }> = {
      EASY: { avgTimeCorrect: 0, avgTimeIncorrect: 0, totalCorrect: 0, totalIncorrect: 0, timeCorrect: 0, timeIncorrect: 0 },
      MEDIUM: { avgTimeCorrect: 0, avgTimeIncorrect: 0, totalCorrect: 0, totalIncorrect: 0, timeCorrect: 0, timeIncorrect: 0 },
      HARD: { avgTimeCorrect: 0, avgTimeIncorrect: 0, totalCorrect: 0, totalIncorrect: 0, timeCorrect: 0, timeIncorrect: 0 },
    };

    // 2. TEMPERAMENT AND STRATEGY ANALYSIS

    // 2.1 Pacing Efficiency
    let totalTimeCorrect = 0;
    let totalTimeIncorrect = 0;
    let countCorrect = 0;
    let countIncorrect = 0;

    // 2.2 Time Utilization by Subject
    const timeBySubject: Record<string, number> = {};

    // Process all answers
    attempt.answers.forEach(answer => {
      const question = answer.question;
      const subject = question.subject;
      const difficulty = question.difficulty;
      const timeSpent = answer.timeSpent || 0;
      const isCorrect = answer.isCorrect === true;

      // Subject-wise accuracy
      if (!subjectWiseAccuracy[subject]) {
        subjectWiseAccuracy[subject] = { correct: 0, total: 0, percentage: 0 };
      }
      subjectWiseAccuracy[subject].total++;
      if (isCorrect) {
        subjectWiseAccuracy[subject].correct++;
      }

      // Difficulty pacing
      if (difficultyPacing[difficulty]) {
        if (isCorrect) {
          difficultyPacing[difficulty].totalCorrect++;
          difficultyPacing[difficulty].timeCorrect += timeSpent;
        } else {
          difficultyPacing[difficulty].totalIncorrect++;
          difficultyPacing[difficulty].timeIncorrect += timeSpent;
        }
      }

      // Pacing efficiency
      if (isCorrect) {
        totalTimeCorrect += timeSpent;
        countCorrect++;
      } else {
        totalTimeIncorrect += timeSpent;
        countIncorrect++;
      }

      // Time by subject
      if (!timeBySubject[subject]) {
        timeBySubject[subject] = 0;
      }
      timeBySubject[subject] += timeSpent;
    });

    // Calculate percentages for subject accuracy
    Object.keys(subjectWiseAccuracy).forEach(subject => {
      const data = subjectWiseAccuracy[subject];
      data.percentage = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    });

    // Calculate averages for difficulty pacing
    Object.keys(difficultyPacing).forEach(difficulty => {
      const data = difficultyPacing[difficulty];
      data.avgTimeCorrect = data.totalCorrect > 0 ? Math.round(data.timeCorrect / data.totalCorrect) : 0;
      data.avgTimeIncorrect = data.totalIncorrect > 0 ? Math.round(data.timeIncorrect / data.totalIncorrect) : 0;
    });

    // 3. PERFORMANCE OVERVIEW
    const attemptSummary = {
      totalMarks: attempt.totalMarks,
      obtainedMarks: attempt.obtainedMarks,
      percentage: attempt.percentage,
      rank: attempt.rank,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeSpent: attempt.timeSpent,
      testTitle: attempt.testActivation.masterTest.title,
      testType: attempt.testActivation.masterTest.testType,
      duration: attempt.testActivation.masterTest.duration,
      aiAnalysisReport: attempt.aiAnalysisReport,
      analysisStatus: attempt.analysisStatus,
    };

    // Pacing efficiency
    const pacingEfficiency = {
      avgTimeCorrect: countCorrect > 0 ? Math.round(totalTimeCorrect / countCorrect) : 0,
      avgTimeIncorrect: countIncorrect > 0 ? Math.round(totalTimeIncorrect / countIncorrect) : 0,
      totalCorrect: countCorrect,
      totalIncorrect: countIncorrect,
    };

    // Convert time by subject to minutes
    const timeUtilization: Record<string, { seconds: number; minutes: number; percentage: number }> = {};
    const totalTimeSpent = Object.values(timeBySubject).reduce((sum, time) => sum + time, 0);
    Object.keys(timeBySubject).forEach(subject => {
      timeUtilization[subject] = {
        seconds: timeBySubject[subject],
        minutes: Math.round(timeBySubject[subject] / 60 * 10) / 10,
        percentage: totalTimeSpent > 0 ? Math.round((timeBySubject[subject] / totalTimeSpent) * 100) : 0,
      };
    });

    // Question-level breakdown for drill-down
    const questionBreakdown = attempt.testActivation.masterTest.questions.map(question => {
      const answer = attempt.answers.find(a => a.questionId === question.id);
      return {
        id: question.id,
        questionOrder: question.questionOrder,
        subject: question.subject,
        difficulty: question.difficulty,
        marks: question.marks,
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        selectedAnswer: answer?.selectedAnswer || null,
        isCorrect: answer?.isCorrect || false,
        timeSpent: answer?.timeSpent || 0,
        marksObtained: answer?.marksObtained || 0,
        isAttempted: !!answer?.selectedAnswer,
      };
    });

    return {
      attemptSummary,
      mistakeAnalysis: {
        subjectWiseAccuracy,
        difficultyPacing,
      },
      temperamentAnalysis: {
        pacingEfficiency,
        timeUtilization,
      },
      questionBreakdown,
    };
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

