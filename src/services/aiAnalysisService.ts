import { GeminiProvider } from './ai/GeminiProvider';
import { AIProvider } from './ai/types';

export class AIAnalysisService {
    private provider: AIProvider;

    constructor(provider?: AIProvider) {
        this.provider = provider || new GeminiProvider();
    }

    async generateTestReport(data: any): Promise<string> {
        const prompt = this.buildPrompt(data);
        const result = await this.provider.generateReport(prompt);
        return result.report;
    }

    private buildPrompt(data: any): string {
        const { attempt, test, subjectPerformance, difficultyPerformance, behavioralPatterns } = data;

        // Format subject performance
        const subjectSummary = Object.entries(subjectPerformance)
            .map(([subject, stats]: [string, any]) => {
                const accuracy = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 0;
                return `- ${subject}: ${stats.correct}/${stats.total} Correct (${accuracy}%)`;
            })
            .join('\n');

        // Format difficulty performance
        const difficultySummary = Object.entries(difficultyPerformance)
            .map(([level, stats]: [string, any]) => {
                const accuracy = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 0;
                return `- ${level}: ${stats.correct}/${stats.total} Correct (${accuracy}%)`;
            })
            .join('\n');

        // Format behavioral patterns
        const behaviorSummary = Object.entries(behavioralPatterns || {})
            .map(([subject, patterns]: [string, any]) => {
                return `### ${subject} Patterns:
- Haste (Silly Mistakes on EASY): ${patterns.haste_mistakes}
- Time Sinks (Over-investment on HARD): ${patterns.time_sinks}
- Strong Basics (Quick + Correct EASY): ${patterns.strong_basics}
- Struggling (Slow + Incorrect EASY): ${patterns.struggling}
- Efficiency (Quick + Correct HARD): ${patterns.efficiency}`;
            })
            .join('\n\n');

        return `
You are an expert academic & behavioral mentor for JEE/NEET preparation.
Your task is to identify WHY the student is achieving their current result by analyzing both their marks and their test-taking behavior.

---

## BEHAVIORAL REASONING RULES

Use the "Behavioral Patterns" data to diagnose the student's exam temperament:

1. **HASTE (Silly Mistakes on EASY)**: 
   - High Haste count indicates rushing or lack of concentration.
   - *Advice*: Slow down on easy questions; use the "one-breath" rule before marking.

2. **TIME SINKS (Over-investment on HARD)**:
   - High Time Sink count indicates "Ego-Trapping" (trying to solve hard questions at the cost of time).
   - *Advice*: Improve question selection; skip hard questions faster (2-minute rule).

3. **STRONG BASICS (Quick & Correct EASY)**:
   - This is a core strength. Mention it as a foundation for confidence.

4. **STRUGGLING (Slow & Incorrect EASY)**:
   - High count indicates core conceptual gaps. These are the highest priority for revision.
   - *Advice*: Stop practice tests and go back to basic theory for these topics.

5. **EFFICIENCY (Quick & Correct HARD)**:
   - High count indicates elite problem-solving skills. Encourage the student to tackle more challenging sets.

---

## Test Context
- Test Title: ${test.title}
- Test Type: ${test.testType}
- Total Marks: ${test.totalMarks}

## Student Outcome
- Marks Obtained: ${attempt.obtainedMarks}
- Percentage: ${attempt.percentage?.toFixed(2)}%
- Rank: ${attempt.rank}
-- Time Spent: ${attempt.timeSpent} minutes

## Behavioral Patterns (Raw Data)
${behaviorSummary}

## Subject-wise Data
${subjectSummary}

## Difficulty-wise Data
${difficultySummary}

---

## REQUIRED OUTPUT FORMAT (FOLLOW STRICTLY)

### Overall Performance Summary
- Classify performance as: STRONG / AVERAGE / WEAK
- Justify this classification in **1–2 sentences**
- Mention rank context

---

### Top Issues Costing Marks
Identify **exactly 3 issues** that most impacted the score.
Each issue must:
- Be specific (subject + difficulty or behavior)
- Explain *why* it reduced marks
- Be written in one short line

Example:
"Spending too much time on HARD Physics questions reduced attempts in EASY sections."

---

### Strengths (What Is Working)
List **2–3 strengths** supported by the data.
Avoid generic praise.
Each point must reference:
- A subject OR difficulty level
- Accuracy, consistency, or efficiency

---

### Weakness Patterns (Not Just Weak Subjects)
Identify **patterns**, not just low scores.
Examples:
- Good EASY performance but poor HARD conversion
- Acceptable accuracy but slow solving
- Strong subject dragged down by one difficulty level

Explain each pattern in **one line**.

---

### Time Management Insight
Analyze time spent (${attempt.timeSpent} minutes) relative to performance.
State clearly whether time usage was:
- Efficient
- Imbalanced
- Inefficient

Explain *how* time usage affected the result in 1–2 lines.

---

### High-Impact Action Plan
Provide **3–5 actions** that:
- Directly target the identified issues
- Are exam-strategy oriented, not generic
- Prioritize actions that can improve score fastest

Each action must include:
- Subject
- Difficulty level or behavior
- Priority tag: HIGH / MEDIUM / LOW

---

### Score Improvement Potential (Estimate)
Based on the issues identified, estimate:
"Fixing the top issues can realistically improve the score by **~X–Y marks**."

This should be a **conservative estimate**, not motivational exaggeration.

---

## STYLE RULES
- Write directly to the student
- No emojis
- No filler
- No repetition
- No restating raw metrics
- Every sentence must add insight

---

Return ONLY Markdown.


    `.trim();
    }
}

export const aiAnalysisService = new AIAnalysisService();
