require('dotenv').config();
const { auth } = require('./config/firebase');

auth.listUsers(1)
  .then(() => console.log('✅ Firebase Admin credentials valid'))
  .catch((err) => console.error('❌', err.message));
