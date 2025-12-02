import { Request, Response } from 'express';
import { operatorService } from '../services/operatorService';
import { AuthRequest } from '../types';
import multer from 'multer';

// Configure multer for CSV file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

export const csvUpload = upload.single('csvFile');

export const operatorController = {
  // Get operator dashboard overview
  getDashboard: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const dashboard = await operatorService.getDashboard(userId);
      res.json({ success: true, data: dashboard });
    } catch (error: any) {
      console.error('Error fetching operator dashboard:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch dashboard' });
    }
  },

  // Create a new master test (without questions)
  createMasterTest: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const testData = req.body;
      const masterTest = await operatorService.createMasterTest(userId, testData);
      res.json({ success: true, data: masterTest });
    } catch (error: any) {
      console.error('Error creating master test:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to create master test' });
    }
  },

  // Validate CSV (without creating test)
  validateCSV: async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const { questions, errors } = await operatorService.parseCSV(csvContent);

      res.json({
        success: true,
        data: {
          valid: errors.length === 0,
          questionsCount: questions.length,
          errors: errors.length > 0 ? errors : undefined,
          preview: questions.slice(0, 5), // Return first 5 questions as preview
        },
      });
    } catch (error: any) {
      console.error('Error validating CSV:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to validate CSV' });
    }
  },

  // Create master test from CSV upload
  createTestFromCSV: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      console.log('📤 CSV Upload Request Body:', req.body);
      console.log('📎 File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
      }

      // Get test metadata from request body
      const { title, description, testType, duration, totalMarks, passingMarks, instructions } = req.body;

      console.log('🔍 Extracted fields:', { title, testType, duration, totalMarks, passingMarks });

      if (!title || !testType || !duration || !totalMarks || !passingMarks) {
        console.log('❌ Missing fields!', { title: !!title, testType: !!testType, duration: !!duration, totalMarks: !!totalMarks, passingMarks: !!passingMarks });
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: title, testType, duration, totalMarks, passingMarks',
        });
      }

      const testData = {
        title,
        description,
        testType,
        duration: parseInt(duration),
        totalMarks: parseInt(totalMarks),
        passingMarks: parseInt(passingMarks),
        instructions,
      };

      const csvContent = req.file.buffer.toString('utf-8');
      const masterTest = await operatorService.createTestFromCSV(userId, testData, csvContent);

      res.json({
        success: true,
        data: masterTest,
        message: `Test created successfully with ${masterTest?.questions.length} questions`,
      });
    } catch (error: any) {
      console.error('Error creating test from CSV:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to create test from CSV' });
    }
  },

  // Get all master tests created by operator
  getMasterTests: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const tests = await operatorService.getMasterTests(userId);
      res.json({ success: true, data: { tests } });
    } catch (error: any) {
      console.error('Error fetching master tests:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch master tests' });
    }
  },

  // Get test details with questions
  getTestDetails: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { testId } = req.params;
      const test = await operatorService.getTestDetails(userId, testId);
      res.json({ success: true, data: test });
    } catch (error: any) {
      console.error('Error fetching test details:', error);
      res.status(404).json({ success: false, message: error.message || 'Failed to fetch test details' });
    }
  },

  // Deactivate test
  deactivateTest: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { testId } = req.params;
      const test = await operatorService.deactivateTest(userId, testId);
      res.json({ success: true, data: test });
    } catch (error: any) {
      console.error('Error deactivating test:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to deactivate test' });
    }
  },

  // Update test metadata
  updateTest: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { testId } = req.params;
      const updateData = req.body;
      const test = await operatorService.updateTest(userId, testId, updateData);
      res.json({ success: true, data: test });
    } catch (error: any) {
      console.error('Error updating test:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to update test' });
    }
  },

  // Get test statistics
  getTestStatistics: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { testId } = req.params;
      const stats = await operatorService.getTestStatistics(userId, testId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error('Error fetching test statistics:', error);
      res.status(404).json({ success: false, message: error.message || 'Failed to fetch test statistics' });
    }
  },

  // Create test with questions (rich text editor)
  createTestWithQuestions: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { testData, questions } = req.body;

      console.log('📝 Creating test with editor - Test data:', testData);
      console.log('📊 Questions count:', questions?.length);

      if (!testData || !questions || questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: testData and questions',
        });
      }

      const masterTest = await operatorService.createTestWithQuestions(userId, testData, questions);

      res.json({
        success: true,
        data: masterTest,
        message: `Test created successfully with ${questions.length} questions`,
      });
    } catch (error: any) {
      console.error('Error creating test with questions:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to create test' });
    }
  },
};
