const { z } = require('zod');

const tag = z.string().trim().min(1).max(30);

const createQuestionSchema = z.object({
  title: z.string().trim().min(15).max(150),
  body: z.string().trim().min(30).max(30000),
  tags: z.array(tag).min(1).max(5),
});

const updateQuestionSchema = z
  .object({
    title: z.string().trim().min(15).max(150).optional(),
    body: z.string().trim().min(30).max(30000).optional(),
    tags: z.array(tag).min(1).max(5).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Provide at least one field to update',
  });

const listQuerySchema = z.object({
  tag: z.string().trim().optional(),
  unanswered: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'score']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

module.exports = { createQuestionSchema, updateQuestionSchema, listQuerySchema };
