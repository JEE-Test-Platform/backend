import { PrismaClient, Subject, QuestionType, Difficulty, TestType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const instituteId = 'cmih4kyce0001m7gnuibt2365'; // hello institute
    const operatorId = 'cmikcit1f0001nz51mayyit49'; // operator

    const masterTest = await prisma.masterTest.create({
        data: {
            title: 'Comprehensive Subject Test',
            description: 'A test covering Physics, Chemistry, and Mathematics with varying difficulties.',
            testType: TestType.MOCK_TEST,
            duration: 60,
            totalMarks: 60,
            passingMarks: 20,
            instructions: 'Answer all questions carefully.',
            createdById: operatorId,
        },
    });

    const subjects: Subject[] = [Subject.PHYSICS, Subject.CHEMISTRY, Subject.MATHEMATICS];
    const difficulties: Difficulty[] = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];
    const types: QuestionType[] = [QuestionType.MCQ, QuestionType.NUMERICAL];

    let order = 1;

    for (const subject of subjects) {
        for (let i = 1; i <= 5; i++) {
            const difficulty = difficulties[i % 3];
            const type = i <= 3 ? QuestionType.MCQ : QuestionType.NUMERICAL;

            const question = await prisma.question.create({
                data: {
                    masterTestId: masterTest.id,
                    questionText: `This is ${subject} question ${i} (${difficulty} ${type})`,
                    questionType: type,
                    subject: subject,
                    difficulty: difficulty,
                    marks: 4,
                    questionOrder: order++,
                    correctAnswer: type === QuestionType.NUMERICAL ? "42" : null,
                    options: type === QuestionType.MCQ ? {
                        create: [
                            { optionLabel: 'A', optionText: 'Option A', isCorrect: true },
                            { optionLabel: 'B', optionText: 'Option B', isCorrect: false },
                            { optionLabel: 'C', optionText: 'Option C', isCorrect: false },
                            { optionLabel: 'D', optionText: 'Option D', isCorrect: false },
                        ]
                    } : undefined
                }
            });
        }
    }

    // Activate the test for the institute
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + 30);

    await prisma.instituteTestActivation.create({
        data: {
            instituteId: instituteId,
            masterTestId: masterTest.id,
            activationDate: now,
            expiryDate: expiry,
            isActive: true,
            maxAttempts: 2,
        },
    });

    console.log(`Successfully created test ${masterTest.id} with 15 questions and activated it for institute 'hello'.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
