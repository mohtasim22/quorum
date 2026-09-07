const express = require('express');
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/verifyToken');
const verifyOwner = require('../middleware/verifyOwner');
const validate = require('../middleware/validate');
const {
  createQuestionSchema,
  updateQuestionSchema,
  listQuerySchema,
} = require('../schemas/questionSchemas');
const {
  createQuestion,
  listQuestions,
  getQuestionBySlug,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');

const router = express.Router();

router.get('/', validate(listQuerySchema, 'query'), listQuestions);
router.post('/', verifyToken, validate(createQuestionSchema), createQuestion);
router.get('/:slug', getQuestionBySlug);
router.patch(
  '/:id',
  verifyToken,
  verifyOwner(prisma.question),
  validate(updateQuestionSchema),
  updateQuestion
);
router.delete('/:id', verifyToken, verifyOwner(prisma.question), deleteQuestion);

module.exports = router;
