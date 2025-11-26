import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/authService';

const authService = new AuthService();

export class AuthController {
  // Register Student
  async registerStudent(req: Request, res: Response) {
    try {
      const result = await authService.registerStudent(req.body);

      res.status(201).json({
        success: true,
        message: 'Student registered successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to register student',
      });
    }
  }

  // Register Institute
  async registerInstitute(req: Request, res: Response) {
    try {
      const result = await authService.registerInstitute(req.body);

      res.status(201).json({
        success: true,
        message: 'Institute registered successfully. Awaiting admin verification.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to register institute',
      });
    }
  }

  // Register Operator
  async registerOperator(req: Request, res: Response) {
    try {
      const result = await authService.registerOperator(req.body);

      res.status(201).json({
        success: true,
        message: 'Operator registered successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to register operator',
      });
    }
  }

  // Register Super Admin
  async registerSuperAdmin(req: Request, res: Response) {
    try {
      const result = await authService.registerSuperAdmin(req.body);

      res.status(201).json({
        success: true,
        message: 'Super Admin registered successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to register super admin',
      });
    }
  }

  // Login
  async login(req: Request, res: Response) {
    try {
      const result = await authService.login(req.body);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Login failed',
      });
    }
  }

  // Get current user profile
  async getMe(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const profile = await authService.getProfile(userId);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch profile',
      });
    }
  }

  // Change password
  async changePassword(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to change password',
      });
    }
  }

  // Logout (client-side token removal, but we acknowledge it)
  async logout(req: AuthRequest, res: Response) {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  // Get all verified institutes (for student registration dropdown)
  async getInstitutes(req: Request, res: Response) {
    try {
      const institutes = await authService.getVerifiedInstitutes();

      res.status(200).json({
        success: true,
        data: institutes,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch institutes',
      });
    }
  }
}
