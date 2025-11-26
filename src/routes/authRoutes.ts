import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import {
  loginValidation,
  studentRegistrationValidation,
  instituteRegistrationValidation,
  operatorRegistrationValidation,
  superAdminRegistrationValidation,
  changePasswordValidation,
  validateRequest,
} from '../middleware/validation';

const router = Router();
const authController = new AuthController();

// Public routes
router.post(
  '/register/student',
  studentRegistrationValidation,
  validateRequest,
  authController.registerStudent.bind(authController)
);

router.post(
  '/register/institute',
  instituteRegistrationValidation,
  validateRequest,
  authController.registerInstitute.bind(authController)
);

router.post(
  '/register/operator',
  operatorRegistrationValidation,
  validateRequest,
  authController.registerOperator.bind(authController)
);

router.post(
  '/register/super-admin',
  superAdminRegistrationValidation,
  validateRequest,
  authController.registerSuperAdmin.bind(authController)
);

router.post(
  '/login',
  loginValidation,
  validateRequest,
  authController.login.bind(authController)
);

// Get verified institutes (for student registration)
router.get('/institutes', authController.getInstitutes.bind(authController));

// Protected routes (require authentication)
router.get('/me', authenticate, authController.getMe.bind(authController));

router.post(
  '/change-password',
  authenticate,
  changePasswordValidation,
  validateRequest,
  authController.changePassword.bind(authController)
);

router.post('/logout', authenticate, authController.logout.bind(authController));

export default router;
