const { z } = require('zod');

const upsertUserSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  photoURL: z.string().trim().max(500).optional(),
});

const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    bio: z.string().trim().max(300).optional(),
    photoURL: z.string().trim().max(500).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Provide at least one field to update',
  });

module.exports = { upsertUserSchema, updateProfileSchema };
