const express = require('express');
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/verifyToken');
const verifyOwner = require('../middleware/verifyOwner');
const validate = require('../middleware/validate');
const { updateAnswerSchema } = require('../schemas/answerSchemas');
const { updateAnswer, deleteAnswer } = require('../controllers/answerController');

const router = express.Router();

router.patch('/:id', verifyToken, verifyOwner(prisma.answer), validate(updateAnswerSchema), updateAnswer);
router.delete('/:id', verifyToken, verifyOwner(prisma.answer), deleteAnswer);

module.exports = router;
