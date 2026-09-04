const { auth } = require('../config/firebase');

const verifyFirebase = async (req, res, next) => {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header' });
  }

  try {
    req.firebaseUser = await auth.verifyIdToken(header.slice(7));
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  next();
};

module.exports = verifyFirebase;
