const prisma = require('../config/prisma');
const { POINTS } = require('../config/reputation');
const httpError = require('../utils/httpError');

const TX_OPTS = { maxWait: 15000, timeout: 20000 };

const AUTHOR = {
  select: { id: true, displayName: true, photoURL: true, slug: true, reputation: true },
};

// POST /api/questions/:questionId/answers
const createAnswer = async (req, res) => {
  const { questionId } = req.params;
  const { body } = req.body;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });
  if (!question) return res.status(404).json({ message: 'Question not found' });

  const answer = await prisma.$transaction(async (tx) => {
    const created = await tx.answer.create({
      data: { body, questionId, authorId: req.user.id },
      include: { author: AUTHOR },
    });

    await tx.question.update({
      where: { id: questionId },
      data: { answerCount: { increment: 1 }, lastActivityAt: new Date() },
    });

    return created;
  }, TX_OPTS);

  res.status(201).json({ ...answer, isAccepted: false });
};

// GET /api/questions/:questionId/answers
const listAnswers = async (req, res) => {
  const { questionId } = req.params;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { acceptedAnswerId: true },
  });
  if (!question) return res.status(404).json({ message: 'Question not found' });

  const rows = await prisma.answer.findMany({
    where: { questionId },
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    take: 100,
    include: { author: AUTHOR },
  });

  const answers = rows.map((a) => ({
    ...a,
    isAccepted: a.id === question.acceptedAnswerId,
  }));

  // accepted answer always sits first, whatever its score
  answers.sort((a, b) => Number(b.isAccepted) - Number(a.isAccepted));

  res.json({ items: answers, total: answers.length });
};

// PATCH /api/answers/:id
const updateAnswer = async (req, res) => {
  const answer = req.record;                  // loaded by verifyOwner

  const updated = await prisma.answer.update({
    where: { id: answer.id },
    data: { body: req.body.body },
    include: { author: AUTHOR },
  });

  await prisma.question.update({
    where: { id: answer.questionId },
    data: { lastActivityAt: new Date() },
  });

  res.json(updated);
};

// DELETE /api/answers/:id
const deleteAnswer = async (req, res) => {
  const answer = req.record;

  await prisma.$transaction(async (tx) => {
    const question = await tx.question.findUnique({
      where: { id: answer.questionId },
      select: { authorId: true, acceptedAnswerId: true },
    });

    // deleting the accepted answer must claw back the bonus.
    // the FK (onDelete: SetNull) clears acceptedAnswerId on its own.
    if (!question) throw httpError(404, 'Question not found');

    const wasAccepted = question.acceptedAnswerId === answer.id;
    const earnedBonus = wasAccepted && answer.authorId !== question.authorId;

    if (earnedBonus) {
      await tx.user.update({
        where: { id: answer.authorId },
        data: { reputation: { decrement: POINTS.ACCEPTED_ANSWER } },
      });
    }

    await tx.answer.delete({ where: { id: answer.id } });

    await tx.question.update({
      where: { id: answer.questionId },
      data: { answerCount: { decrement: 1 }, lastActivityAt: new Date() },
    });
  }, TX_OPTS);

  res.json({ message: 'Answer deleted' });
};

// PATCH /api/questions/:id/accept   body: { answerId: string | null }
const acceptAnswer = async (req, res) => {
  const question = req.record;                // verifyOwner ⇒ asker or admin
  const { answerId } = req.body;

  if (question.acceptedAnswerId === answerId) {
    return res.json({ id: question.id, acceptedAnswerId: answerId });
  }

  const updated = await prisma.$transaction(async (tx) => {
    // reverse the previous winner
    if (question.acceptedAnswerId) {
      const prev = await tx.answer.findUnique({
        where: { id: question.acceptedAnswerId },
        select: { authorId: true },
      });
      if (prev && prev.authorId !== question.authorId) {
        await tx.user.update({
          where: { id: prev.authorId },
          data: { reputation: { decrement: POINTS.ACCEPTED_ANSWER } },
        });
      }
    }

    // award the new one
    if (answerId) {
      const next = await tx.answer.findUnique({
        where: { id: answerId },
        select: { authorId: true, questionId: true },
      });

      // checked inside the tx: the row cannot vanish between check and write
      if (!next || next.questionId !== question.id) {
        throw httpError(400, 'That answer does not belong to this question');
      }

      if (next.authorId !== question.authorId) {
        await tx.user.update({
          where: { id: next.authorId },
          data: { reputation: { increment: POINTS.ACCEPTED_ANSWER } },
        });
      }
    }

    return tx.question.update({
      where: { id: question.id },
      data: { acceptedAnswerId: answerId, lastActivityAt: new Date() },
      select: { id: true, acceptedAnswerId: true },
    });
  }, TX_OPTS);

  res.json(updated);
};

module.exports = {
  createAnswer, listAnswers, updateAnswer, deleteAnswer, acceptAnswer,
};
