const { z } = require('zod');

const createCommentSchema = z
  .object({
    body: z.string().trim().min(2).max(600),
    questionId: z.string().min(1).optional(),
    answerId: z.string().min(1).optional(),
  })
  .refine((d) => !!d.questionId !== !!d.answerId, {
    message: 'Provide exactly one of questionId or answerId',
  });

const listCommentsSchema = z
  .object({
    questionId: z.string().min(1).optional(),
    answerId: z.string().min(1).optional(),
  })
  .refine((d) => !!d.questionId !== !!d.answerId, {
    message: 'Provide exactly one of questionId or answerId',
  });

module.exports = { createCommentSchema, listCommentsSchema };
