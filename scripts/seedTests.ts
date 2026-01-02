import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding tests...');

    // Find the student with email haha@gmail.com
    const user = await prisma.user.findUnique({
        where: { email: 'haha@gmail.com' },
        include: { student: true },
    });

    if (!user || !user.student) {
        throw new Error('Student with email haha@gmail.com not found');
    }

    const student = user.student;
    console.log(`✅ Found student: ${student.firstName} ${student.lastName}`);

    // Test 1: JEE Main Practice Test 1
    const test1 = await prisma.masterTest.create({
        data: {
            title: 'JEE Main Practice Test 1',
            description: 'Quick practice test covering Physics, Chemistry, and Mathematics',
            testType: 'PRACTICE',
            duration: 10,
            totalMarks: 24,
            passingMarks: 12,
            instructions: 'Attempt all questions. Each question carries 4 marks.',
            questions: {
                create: [
                    // Physics Questions
                    {
                        questionOrder: 1,
                        subject: 'PHYSICS',
                        difficulty: 'EASY',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>A body of mass 2 kg is moving with a velocity of 10 m/s. What is its kinetic energy?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>50 J</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>100 J</p>', isCorrect: true },
                                { optionLabel: 'C', optionText: '<p>150 J</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>200 J</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>Kinetic Energy = (1/2)mv² = (1/2) × 2 × 10² = 100 J</p>',
                    },
                    {
                        questionOrder: 2,
                        subject: 'PHYSICS',
                        difficulty: 'MEDIUM',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>The resistance of a wire is 10 Ω. If the wire is stretched to double its length, what will be its new resistance?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>20 Ω</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>40 Ω</p>', isCorrect: true },
                                { optionLabel: 'C', optionText: '<p>5 Ω</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>10 Ω</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>When length is doubled, area becomes half. R = ρL/A, so new R = ρ(2L)/(A/2) = 4ρL/A = 4R = 40 Ω</p>',
                    },
                    // Chemistry Questions
                    {
                        questionOrder: 3,
                        subject: 'CHEMISTRY',
                        difficulty: 'EASY',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>What is the molecular formula of glucose?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>C₆H₁₂O₆</p>', isCorrect: true },
                                { optionLabel: 'B', optionText: '<p>C₆H₁₀O₅</p>', isCorrect: false },
                                { optionLabel: 'C', optionText: '<p>C₅H₁₂O₆</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>C₆H₁₂O₅</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>Glucose has the molecular formula C₆H₁₂O₆</p>',
                    },
                    {
                        questionOrder: 4,
                        subject: 'CHEMISTRY',
                        difficulty: 'MEDIUM',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>Which of the following is the strongest acid?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>HCl</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>HClO₄</p>', isCorrect: true },
                                { optionLabel: 'C', optionText: '<p>H₂SO₄</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>HNO₃</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>Perchloric acid (HClO₄) is one of the strongest acids known</p>',
                    },
                    // Mathematics Questions
                    {
                        questionOrder: 5,
                        subject: 'MATHEMATICS',
                        difficulty: 'EASY',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>What is the value of sin(90°)?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>0</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>1</p>', isCorrect: true },
                                { optionLabel: 'C', optionText: '<p>-1</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>∞</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>sin(90°) = 1</p>',
                    },
                    {
                        questionOrder: 6,
                        subject: 'MATHEMATICS',
                        difficulty: 'MEDIUM',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>If f(x) = x² + 2x + 1, what is f(3)?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>12</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>16</p>', isCorrect: true },
                                { optionLabel: 'C', optionText: '<p>18</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>20</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>f(3) = 3² + 2(3) + 1 = 9 + 6 + 1 = 16</p>',
                    },
                ],
            },
        },
    });

    console.log(`✅ Created Test 1: ${test1.title}`);

    // Test 2: JEE Main Practice Test 2
    const test2 = await prisma.masterTest.create({
        data: {
            title: 'JEE Main Practice Test 2',
            description: 'Second quick practice test covering Physics, Chemistry, and Mathematics',
            testType: 'PRACTICE',
            duration: 10,
            totalMarks: 24,
            passingMarks: 12,
            instructions: 'Attempt all questions. Each question carries 4 marks.',
            questions: {
                create: [
                    // Physics Questions
                    {
                        questionOrder: 1,
                        subject: 'PHYSICS',
                        difficulty: 'EASY',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>What is the SI unit of force?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>Joule</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>Newton</p>', isCorrect: true },
                                { optionLabel: 'C', optionText: '<p>Watt</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>Pascal</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>The SI unit of force is Newton (N)</p>',
                    },
                    {
                        questionOrder: 2,
                        subject: 'PHYSICS',
                        difficulty: 'HARD',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>A particle moves in a circle of radius 20 cm with a constant speed of 10 m/s. What is its centripetal acceleration?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>50 m/s²</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>100 m/s²</p>', isCorrect: false },
                                { optionLabel: 'C', optionText: '<p>500 m/s²</p>', isCorrect: true },
                                { optionLabel: 'D', optionText: '<p>1000 m/s²</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>Centripetal acceleration = v²/r = 10²/0.2 = 100/0.2 = 500 m/s²</p>',
                    },
                    // Chemistry Questions
                    {
                        questionOrder: 3,
                        subject: 'CHEMISTRY',
                        difficulty: 'EASY',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>What is the atomic number of Carbon?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>4</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>6</p>', isCorrect: true },
                                { optionLabel: 'C', optionText: '<p>8</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>12</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>Carbon has atomic number 6</p>',
                    },
                    {
                        questionOrder: 4,
                        subject: 'CHEMISTRY',
                        difficulty: 'HARD',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>Which of the following has the highest bond energy?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>C-C</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>C=C</p>', isCorrect: false },
                                { optionLabel: 'C', optionText: '<p>C≡C</p>', isCorrect: true },
                                { optionLabel: 'D', optionText: '<p>C-H</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>Triple bonds (C≡C) have the highest bond energy among carbon-carbon bonds</p>',
                    },
                    // Mathematics Questions
                    {
                        questionOrder: 5,
                        subject: 'MATHEMATICS',
                        difficulty: 'EASY',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>What is the derivative of x³?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>x²</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>2x²</p>', isCorrect: false },
                                { optionLabel: 'C', optionText: '<p>3x²</p>', isCorrect: true },
                                { optionLabel: 'D', optionText: '<p>3x</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>d/dx(x³) = 3x²</p>',
                    },
                    {
                        questionOrder: 6,
                        subject: 'MATHEMATICS',
                        difficulty: 'HARD',
                        marks: 4,
                        questionType: 'MCQ',
                        questionText: '<p>What is the value of ∫₀¹ x² dx?</p>',
                        options: {
                            create: [
                                { optionLabel: 'A', optionText: '<p>1/2</p>', isCorrect: false },
                                { optionLabel: 'B', optionText: '<p>1/3</p>', isCorrect: true },
                                { optionLabel: 'C', optionText: '<p>1/4</p>', isCorrect: false },
                                { optionLabel: 'D', optionText: '<p>1</p>', isCorrect: false },
                            ],
                        },
                        explanation: '<p>∫x² dx = x³/3, so ∫₀¹ x² dx = [x³/3]₀¹ = 1/3 - 0 = 1/3</p>',
                    },
                ],
            },
        },
    });

    console.log(`✅ Created Test 2: ${test2.title}`);

    // Activate both tests for the student's institute
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // Valid for 30 days

    const activation1 = await prisma.instituteTestActivation.create({
        data: {
            instituteId: student.instituteId,
            masterTestId: test1.id,
            activationDate: now,
            expiryDate: expiryDate,
            startTime: '00:00',
            endTime: '23:59',
            maxAttempts: 3,
            isActive: true,
        },
    });

    console.log(`✅ Activated Test 1 for institute`);

    const activation2 = await prisma.instituteTestActivation.create({
        data: {
            instituteId: student.instituteId,
            masterTestId: test2.id,
            activationDate: now,
            expiryDate: expiryDate,
            startTime: '00:00',
            endTime: '23:59',
            maxAttempts: 3,
            isActive: true,
        },
    });

    console.log(`✅ Activated Test 2 for institute`);

    console.log('\n🎉 Successfully seeded 2 tests!');
    console.log(`📝 Test 1: ${test1.title} (ID: ${test1.id})`);
    console.log(`📝 Test 2: ${test2.title} (ID: ${test2.id})`);
    console.log(`\n👤 Student: ${student.firstName} ${student.lastName} (${user.email})`);
    console.log(`🏫 Institute ID: ${student.instituteId}`);
    console.log(`\n✅ Both tests are now available for the student to attempt!`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding tests:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
