import { Response } from 'express';
import { AuthRequest } from '../types';
import * as superadminService from '../services/superadminService';

// Dashboard
export const getDashboard = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.userId;
    const dashboardData = await superadminService.getDashboard(userId);

    return res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard data',
    });
  }
};

// ==================== OPERATOR ENDPOINTS ====================

export const getAllOperators = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const operators = await superadminService.getAllOperators();

    return res.status(200).json({
      success: true,
      data: operators,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch operators',
    });
  }
};

export const getOperatorById = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { operatorId } = req.params;
    const operator = await superadminService.getOperatorById(operatorId);

    return res.status(200).json({
      success: true,
      data: operator,
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      message: error.message || 'Operator not found',
    });
  }
};

export const createOperator = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const operator = await superadminService.createOperator(req.body);

    return res.status(201).json({
      success: true,
      data: operator,
      message: 'Operator created successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create operator',
    });
  }
};

export const updateOperator = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { operatorId } = req.params;
    const operator = await superadminService.updateOperator(operatorId, req.body);

    return res.status(200).json({
      success: true,
      data: operator,
      message: 'Operator updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update operator',
    });
  }
};

export const deleteOperator = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { operatorId } = req.params;
    const result = await superadminService.deleteOperator(operatorId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete operator',
    });
  }
};

export const toggleOperatorStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { operatorId } = req.params;
    const result = await superadminService.toggleOperatorStatus(operatorId);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Operator status updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to toggle operator status',
    });
  }
};

// ==================== INSTITUTE ENDPOINTS ====================

export const getAllInstitutes = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const institutes = await superadminService.getAllInstitutes();

    return res.status(200).json({
      success: true,
      data: institutes,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch institutes',
    });
  }
};

export const getInstituteById = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { instituteId } = req.params;
    const institute = await superadminService.getInstituteById(instituteId);

    return res.status(200).json({
      success: true,
      data: institute,
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      message: error.message || 'Institute not found',
    });
  }
};

export const createInstitute = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const institute = await superadminService.createInstitute(req.body);

    return res.status(201).json({
      success: true,
      data: institute,
      message: 'Institute created successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create institute',
    });
  }
};

export const updateInstitute = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { instituteId } = req.params;
    const institute = await superadminService.updateInstitute(instituteId, req.body);

    return res.status(200).json({
      success: true,
      data: institute,
      message: 'Institute updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update institute',
    });
  }
};

export const deleteInstitute = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { instituteId } = req.params;
    const result = await superadminService.deleteInstitute(instituteId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete institute',
    });
  }
};

export const verifyInstitute = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { instituteId } = req.params;
    const result = await superadminService.verifyInstitute(instituteId);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Institute verified successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to verify institute',
    });
  }
};

export const toggleInstituteStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { instituteId } = req.params;
    const result = await superadminService.toggleInstituteStatus(instituteId);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Institute status updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to toggle institute status',
    });
  }
};

// ==================== STUDENT ENDPOINTS ====================

export const getAllStudents = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { instituteId, search } = req.query;
    const filters: any = {};

    if (instituteId) filters.instituteId = instituteId as string;
    if (search) filters.search = search as string;

    const students = await superadminService.getAllStudents(filters);

    return res.status(200).json({
      success: true,
      data: students,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch students',
    });
  }
};

export const getStudentById = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { studentId } = req.params;
    const student = await superadminService.getStudentById(studentId);

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      message: error.message || 'Student not found',
    });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { studentId } = req.params;
    const student = await superadminService.updateStudent(studentId, req.body);

    return res.status(200).json({
      success: true,
      data: student,
      message: 'Student updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update student',
    });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { studentId } = req.params;
    const result = await superadminService.deleteStudent(studentId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete student',
    });
  }
};

export const toggleStudentStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { studentId } = req.params;
    const result = await superadminService.toggleStudentStatus(studentId);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Student status updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to toggle student status',
    });
  }
};

// ==================== ANALYTICS ENDPOINTS ====================

export const getPerformanceAnalytics = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const analytics = await superadminService.getOverallPerformanceAnalytics();

    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch performance analytics',
    });
  }
};

export const getTopPerformers = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const topPerformers = await superadminService.getTopPerformers(limit);

    return res.status(200).json({
      success: true,
      data: topPerformers,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch top performers',
    });
  }
};
