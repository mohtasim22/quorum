const prisma = require('../config/prisma');
const uniqueSlug = require('../utils/uniqueSlug');
const normalizeTags = require('../utils/normalizeTags');

// Neon is serverless: a cold pool can take seconds to hand out a transaction.
const TX_OPTS = { maxWait: 15000, timeout: 20000 };

const questionInclude = {
  author: {
    select: { id: true, displayName: true, photoURL: true, slug: true, reputation: true },
  },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
};

// join rows -> plain tag names, so the client never sees [{tag:{name}}]
const shape = (q) => ({ ...q, tags: q.tags.map((t) => t.tag.name) });

// POST /api/questions
const createQuestion = async (req, res) => {
  const { title, body, tags } = req.body;

  const names = normalizeTags(tags);
  if (names.length === 0) {
    return res.status(400).json({ message: 'At least one valid tag is required' });
  }

  const slug = await uniqueSlug(prisma.question, title, 'question');

  const question = await prisma.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        title,
        body,
        slug,
        authorId: req.user.id,          // from the token, never the body
        tags: {
          create: names.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name, slug: name },
              },
            },
          })),
        },
      },
      include: questionInclude,
    });

    await tx.tag.updateMany({
      where: { name: { in: names } },
      data: { questionCount: { increment: 1 } },
    });

    return created;
  }, TX_OPTS);

  res.status(201).json(shape(question));
};

// GET /api/questions
const listQuestions = async (req, res) => {
  const { tag, unanswered, sort, page, limit } = req.query;

  const where = {
    ...(tag && { tags: { some: { tag: { name: tag } } } }),
    ...(unanswered === 'true' && { answerCount: 0 }),
  };

  /** @type {import('../generated/prisma').Prisma.QuestionOrderByWithRelationInput[]} */
  const orderBy =
    sort === 'score'
      ? [{ score: 'desc' }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }];

  // Two independent reads: Promise.all, not $transaction. A paginated count is
  // allowed to be a moment stale, and a read-only transaction on a serverless
  // pool costs a transaction slot for no benefit.
  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: questionInclude,
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    items: items.map(shape),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
};

// GET /api/questions/:slug
const getQuestionBySlug = async (req, res) => {
  const question = await prisma.question.update({
    where: { slug: req.params.slug },
    data: { viewCount: { increment: 1 } },
    include: questionInclude,
  });

  res.json(shape(question));
};

// PATCH /api/questions/:id
const updateQuestion = async (req, res) => {
  const question = req.record;              // loaded by verifyOwner
  const { title, body, tags } = req.body;

  /** @type {string[] | null} */
  let names = null;
  if (tags) {
    names = normalizeTags(tags);
    if (names.length === 0) {
      return res.status(400).json({ message: 'At least one valid tag is required' });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (names) {
      const current = await tx.questionTag.findMany({
        where: { questionId: question.id },
        select: { tag: { select: { name: true } } },
      });
      const currentNames = current.map((r) => r.tag.name);

      const removed = currentNames.filter((n) => !names.includes(n));
      const added = names.filter((n) => !currentNames.includes(n));

      if (removed.length) {
        await tx.questionTag.deleteMany({
          where: { questionId: question.id, tag: { name: { in: removed } } },
        });
        await tx.tag.updateMany({
          where: { name: { in: removed } },
          data: { questionCount: { decrement: 1 } },
        });
      }

      for (const name of added) {
        await tx.questionTag.create({
          data: {
            question: { connect: { id: question.id } },
            tag: { connectOrCreate: { where: { name }, create: { name, slug: name } } },
          },
        });
      }

      if (added.length) {
        await tx.tag.updateMany({
          where: { name: { in: added } },
          data: { questionCount: { increment: 1 } },
        });
      }
    }

    return tx.question.update({
      where: { id: question.id },
      data: {
        ...(title !== undefined && { title }),
        ...(body !== undefined && { body }),
        lastActivityAt: new Date(),
      },
      include: questionInclude,
    });
  }, TX_OPTS);

  res.json(shape(updated));
};

// DELETE /api/questions/:id
const deleteQuestion = async (req, res) => {
  const question = req.record;

  await prisma.$transaction(async (tx) => {
    // read the names BEFORE deleting — the cascade removes the join rows
    const rows = await tx.questionTag.findMany({
      where: { questionId: question.id },
      select: { tag: { select: { name: true } } },
    });
    const names = rows.map((r) => r.tag.name);

    if (names.length) {
      await tx.tag.updateMany({
        where: { name: { in: names } },
        data: { questionCount: { decrement: 1 } },
      });
    }

    await tx.question.delete({ where: { id: question.id } });
  }, TX_OPTS);

  res.json({ message: 'Question deleted' });
};

module.exports = {
  createQuestion,
  listQuestions,
  getQuestionBySlug,
  updateQuestion,
  deleteQuestion,
};
