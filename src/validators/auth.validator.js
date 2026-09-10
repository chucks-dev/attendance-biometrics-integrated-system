const { z } = require('zod');
const { PASSWORD_REGEX } = require('../utils/password');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    PASSWORD_REGEX,
    'Password must include an uppercase letter, lowercase letter, number, and special character'
  );

const APPLICATION_NUMBER_REGEX = /^FPN\/(NDE|NDM|HND)\/\d{4}\/\d{13,14}$/;

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const lecturerRegisterSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    email: z.string().email(),
    phoneNumber: z.string().min(7).max(20),
    gender: z.enum(['MALE', 'FEMALE']),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const lecturerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const studentRegisterSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    email: z.string().email(),
    phoneNumber: z.string().min(7).max(20),
    gender: z.enum(['MALE', 'FEMALE']),
    departmentId: z.string().uuid(),
    program: z.enum(['NDE', 'NDM', 'HND']),
    level: z.enum(['NDE1', 'NDE2', 'ND1', 'ND2', 'HND1', 'HND2']),
    applicationNumber: z
      .string()
      .regex(
        APPLICATION_NUMBER_REGEX,
        'Application number must match FPN/{NDE|NDM|HND}/YYYY/xxxxxxxxxxxxx'
      ),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const studentLoginSchema = z.object({
  applicationNumber: z.string().regex(APPLICATION_NUMBER_REGEX, 'Invalid application number format'),
  password: z.string().min(1),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(), // may also arrive via httpOnly cookie
});

module.exports = {
  APPLICATION_NUMBER_REGEX,
  adminLoginSchema,
  lecturerRegisterSchema,
  lecturerLoginSchema,
  studentRegisterSchema,
  studentLoginSchema,
  changePasswordSchema,
  refreshSchema,
};
