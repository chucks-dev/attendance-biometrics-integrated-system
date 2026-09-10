const { z } = require('zod');

const userQuerySchema = z.object({
  role: z.enum(['LECTURER', 'STUDENT']).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']),
});

const idParamSchema = z.object({ id: z.string().uuid() });

module.exports = { userQuerySchema, updateStatusSchema, idParamSchema };
