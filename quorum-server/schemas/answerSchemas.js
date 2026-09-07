const { z } = require('zod');

const createAnswerSchema = z.object({
  body: z.string().trim().min(30).max(30000),
});

const updateAnswerSchema = z.object({
  body: z.string().trim().min(30).max(30000),
});

// null clears the accepted answer
const acceptAnswerSchema = z.object({
  answerId: z.string().min(1).nullable(),
});

module.exports = { createAnswerSchema, updateAnswerSchema, acceptAnswerSchema };
