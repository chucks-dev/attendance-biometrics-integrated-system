const { z } = require('zod');

const createDepartmentSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(10).toUpperCase(),
});

const updateDepartmentSchema = createDepartmentSchema.partial();

const idParamSchema = z.object({
  id: z.string().uuid(),
});

module.exports = { createDepartmentSchema, updateDepartmentSchema, idParamSchema };
