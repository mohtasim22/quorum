const verifyOwner = (Model, param = 'id') => async (req, res, next) => {
  const doc = await Model.findById(req.params[param]);

  if (!doc) return res.status(404).json({ message: 'Not found' });

  const isOwner = doc.author?.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ message: 'You can only modify your own posts' });
  }

  req.doc = doc;
  next();
};

module.exports = verifyOwner;
