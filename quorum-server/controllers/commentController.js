const prisma = require('../config/prisma');

const AUTHOR = {
  select: { id: true, displayName: true, photoURL: true, slug: true },
};

// GET /api/comments?questionId=  |  ?answerId=
const listComments = async (req, res) => {
  const { questionId, answerId } = req.query;

  const comments = await prisma.comment.findMany({
    where: questionId ? { questionId } : { answerId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { author: AUTHOR },
  });

  res.json({ items: comments, total: comments.length });
};

// POST /api/comments
const createComment = async (req, res) => {
  const { body, questionId, answerId } = req.body;   // Zod guarantees exactly one

  // resolve the owning question so "recently active" stays honest
  let ownerQuestionId = questionId;

  if (answerId) {
    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: { questionId: true },
    });
    if (!answer) return res.status(404).json({ message: 'Answer not found' });
    ownerQuestionId = answer.questionId;
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { body, questionId, answerId, authorId: req.user.id },
      include: { author: AUTHOR },
    });

    await tx.question.update({
      where: { id: ownerQuestionId },
      data: { lastActivityAt: new Date() },
    });

    return created;
  }, { maxWait: 15000, timeout: 20000 });

  res.status(201).json(comment);
};

// DELETE /api/comments/:id
const deleteComment = async (req, res) => {
  await prisma.comment.delete({ where: { id: req.record.id } });
  res.json({ message: 'Comment deleted' });
};

module.exports = { listComments, createComment, deleteComment };
