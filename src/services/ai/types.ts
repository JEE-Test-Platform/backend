export interface AIReportResult {
    report: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface AIProvider {
    generateReport(prompt: string): Promise<AIReportResult>;
}
