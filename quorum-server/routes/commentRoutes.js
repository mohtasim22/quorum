const express = require('express');
const prisma = require('../config/prisma');
const verifyToken = require('../middleware/verifyToken');
const verifyOwner = require('../middleware/verifyOwner');
const validate = require('../middleware/validate');
const { createCommentSchema, listCommentsSchema } = require('../schemas/commentSchemas');
const { listComments, createComment, deleteComment } = require('../controllers/commentController');

const router = express.Router();

router.get('/', validate(listCommentsSchema, 'query'), listComments);
router.post('/', verifyToken, validate(createCommentSchema), createComment);
router.delete('/:id', verifyToken, verifyOwner(prisma.comment), deleteComment);

module.exports = router;
