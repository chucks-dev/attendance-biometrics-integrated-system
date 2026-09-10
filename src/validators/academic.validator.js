const { z } = require('zod');

const PROGRAM = z.enum(['NDE', 'NDM', 'HND']);
const LEVEL = z.enum(['NDE1', 'NDE2', 'ND1', 'ND2', 'HND1', 'HND2']);

const createSessionSchema = z.object({
  name: z
    .string()
    .regex(/^\d{4}\/\d{4}$/, 'Format must be YYYY/YYYY, e.g. 2026/2027'),

  startDate: z.coerce.date(),

  endDate: z.coerce.date(),

  isActive: z.boolean().optional().default(false),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

const createSemesterSchema = z.object({
  academicSessionId: z.string().uuid(),

  name: z.enum(['FIRST', 'SECOND']),

  startDate: z.coerce.date(),

  endDate: z.coerce.date(),

  isActive: z.boolean().optional().default(false),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

const createCourseSchema = z.object({
  courseCode: z.string().min(3).max(15).toUpperCase(),
  courseTitle: z.string().min(3).max(200),
  creditUnit: z.number().int().min(1).max(10),
  departmentId: z.string().uuid(),
  program: PROGRAM,
  level: LEVEL,
  semesterId: z.string().uuid(),
  lecturerId: z.string().uuid().optional().nullable(),
});

const updateCourseSchema = createCourseSchema.partial();

const assignLecturerSchema = z.object({
  lecturerId: z.string().uuid(),
});

const courseQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  program: PROGRAM.optional(),
  level: LEVEL.optional(),
  semesterId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  createSessionSchema,
  createSemesterSchema,
  createCourseSchema,
  updateCourseSchema,
  assignLecturerSchema,
  courseQuerySchema,
  idParamSchema,
};