const verifyOwner = (delegate, param = 'id') => async (req, res, next) => {
  const record = await delegate.findUnique({ where: { id: req.params[param] } });

  if (!record) return res.status(404).json({ message: 'Not found' });

  const isOwner = record.authorId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ message: 'You can only modify your own posts' });
  }

  req.record = record;
  next();
};

module.exports = verifyOwner;


