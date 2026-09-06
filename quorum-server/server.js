require('dotenv').config();
const app = require('./app');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 5000;

prisma.$queryRaw`SELECT 1`
  .then(() => app.listen(PORT, () => console.log(`Listening on ${PORT}`)))
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });
