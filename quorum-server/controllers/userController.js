const prisma = require('../config/prisma');
const uniqueSlug = require('../utils/uniqueSlug');

// POST /api/users
const upsertUser = async (req, res) => {
  const { uid, email } = req.firebaseUser;
  if (!email) {
    return res.status(400).json({ message: 'Account has no email address' });
  }

  const { displayName, photoURL } = req.body;

  const existing = await prisma.user.findUnique({ where: { uid } });
  if (existing) {
    const user = await prisma.user.update({
      where: { uid },
      data: { displayName, photoURL },
    });
    return res.json(user);
  }

  const slug = await uniqueSlug(prisma.user, displayName || '', email.split('@')[0]);

  const user = await prisma.user.create({
    data: {
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      photoURL: photoURL || '',
      slug,
    },
  });

  res.status(201).json(user);
};

// GET /api/users/me
const getMe = async (req, res) => {
  res.json(req.user);
};

// GET /api/users/:slug
const getBySlug = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { slug: req.params.slug },
    select: {
      displayName: true, photoURL: true, bio: true,
      reputation: true, slug: true, createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json(user);
};

module.exports = { upsertUser, getMe, getBySlug };
