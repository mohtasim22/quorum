const User = require('../models/User');
const uniqueSlug = require('../utils/uniqueSlug');

// POST /api/users — called once, right after first sign-in
const upsertUser = async (req, res) => {
  const { uid, email } = req.firebaseUser;

  const existing = await User.findOne({ uid });
  if (existing) return res.status(200).json(existing);

  const { displayName, photoURL } = req.body;

  const slug = await uniqueSlug(User, displayName || '', email.split('@')[0]);

  const user = await User.create({
    uid,                                  
    email,                                
    displayName: displayName || email.split('@')[0],
    photoURL: photoURL || '',
    slug,
  });

  res.status(201).json(user);
};

// GET /api/users/me
const getMe = async (req, res) => {
  res.json(req.user);
};

// GET /api/users/:slug — public
const getBySlug = async (req, res) => {
  const user = await User.findOne({ slug: req.params.slug }).select(
    'displayName photoURL bio reputation slug createdAt'
  );

  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json(user);
};

module.exports = { upsertUser, getMe, getBySlug };
