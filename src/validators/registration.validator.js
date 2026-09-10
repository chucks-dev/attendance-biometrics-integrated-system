const { z } = require('zod');

const registerCoursesSchema = z.object({
  courseIds: z.array(z.string().uuid()).min(1, 'Select at least one course'),
});

module.exports = { registerCoursesSchema };
