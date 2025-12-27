import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIReportResult } from './types';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export class GeminiProvider implements AIProvider {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined in environment variables');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }

    async generateReport(prompt: string): Promise<AIReportResult> {
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return {
                report: text,
            };
        } catch (error) {
            console.error('[GeminiProvider] Error generating report:', error);
            throw error;
        }
    }
}
