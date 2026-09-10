const { z } = require('zod');

const recordQuerySchema = z.object({
  courseId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT']).optional(),
  verificationMethod: z.enum(['QR_CODE', 'DEVICE_FINGERPRINT', 'QR_AND_FINGERPRINT']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = { recordQuerySchema };
