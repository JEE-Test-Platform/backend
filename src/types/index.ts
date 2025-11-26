import { Request } from 'express';
import { Role } from '@prisma/client';

// Extend Express Request to include user data from JWT
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: Role;
    profileId?: string; // student/institute/operator/superAdmin id
  };
}

// Registration DTOs
export interface RegisterStudentDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  instituteId: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyContact?: string;
}

export interface RegisterInstituteDTO {
  email: string;
  password: string;
  instituteName: string;
  registrationNo?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  website?: string;
  establishedYear?: number;
  principalName?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}

export interface RegisterOperatorDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  department?: string;
  designation?: string;
}

export interface RegisterSuperAdminDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  permissions?: any;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  profileId?: string;
}

export interface UpdateProfileDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyContact?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}
