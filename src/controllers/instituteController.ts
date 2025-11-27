import { Request, Response } from 'express';
import { instituteService } from '../services/instituteService';
import { AuthRequest } from '../types';

export const instituteController = {
  // Get institute dashboard overview
  getDashboard: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const dashboard = await instituteService.getDashboard(userId);
      res.json({ success: true, data: dashboard });
    } catch (error: any) {
      console.error('Error fetching dashboard:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch dashboard' });
    }
  },

  // Get all students in the institute
  getStudents: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const students = await instituteService.getStudents(userId);
      res.json({ success: true, data: { students } });
    } catch (error: any) {
      console.error('Error fetching students:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch students' });
    }
  },

  // Add a new student
  addStudent: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const studentData = req.body;
      const student = await instituteService.addStudent(userId, studentData);
      res.json({ success: true, data: student });
    } catch (error: any) {
      console.error('Error adding student:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to add student' });
    }
  },

  // Bulk upload students
  bulkUploadStudents: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const studentsData = req.body.students; // Expecting array of student objects
      
      if (!studentsData || !Array.isArray(studentsData)) {
        return res.status(400).json({ success: false, message: 'Invalid students data' });
      }

      const result = await instituteService.bulkUploadStudents(userId, studentsData);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error bulk uploading students:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to upload students' });
    }
  },

  // Toggle student status (activate/deactivate)
  toggleStudentStatus: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { studentId } = req.params;
      const student = await instituteService.toggleStudentStatus(userId, studentId);
      res.json({ success: true, data: student });
    } catch (error: any) {
      console.error('Error toggling student status:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to update student status' });
    }
  },

  // Get all master tests available for activation
  getMasterTests: async (req: AuthRequest, res: Response) => {
    try {
      const tests = await instituteService.getMasterTests();
      res.json({ success: true, data: { tests } });
    } catch (error: any) {
      console.error('Error fetching master tests:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch master tests' });
    }
  },

  // Activate a test for the institute
  activateTest: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const activationData = req.body;
      const activation = await instituteService.activateTest(userId, activationData);
      res.json({ success: true, data: activation });
    } catch (error: any) {
      console.error('Error activating test:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to activate test' });
    }
  },

  // Get all test activations for the institute
  getTestActivations: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const activations = await instituteService.getTestActivations(userId);
      res.json({ success: true, data: { activations } });
    } catch (error: any) {
      console.error('Error fetching test activations:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch test activations' });
    }
  },

  // Deactivate a test
  deactivateTest: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { activationId } = req.params;
      const activation = await instituteService.deactivateTest(userId, activationId);
      res.json({ success: true, data: activation });
    } catch (error: any) {
      console.error('Error deactivating test:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to deactivate test' });
    }
  },

  // Extend test deadline
  extendDeadline: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { activationId } = req.params;
      const { expiryDate } = req.body;
      const activation = await instituteService.extendDeadline(userId, activationId, expiryDate);
      res.json({ success: true, data: activation });
    } catch (error: any) {
      console.error('Error extending deadline:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to extend deadline' });
    }
  },

  // Get analytics
  getAnalytics: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { period } = req.query;
      const analytics = await instituteService.getAnalytics(userId, period as string);
      res.json({ success: true, data: analytics });
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch analytics' });
    }
  },
};
