const { auth } = require("../config/firebase");
const prisma = require('../config/prisma');


const verifyToken = async(req, res, next)=>{
    const header =  req.headers.authorization || '';
    if (!header.startsWith('Bearer ')){
        return res.status(401).json({ message : 'Missing or malformed Authorization header'})
    }


const token = header.slice(7);
let decoded;
try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  const user = await prisma.user.findUnique({ where: { uid: decoded.uid } });

  if (!user) {
    return res.status(401).json({ message: 'No account exists for this token' });
  }

  req.firebaseUser = decoded;  
  req.user = user;             

  next();
}

module.exports = verifyToken;