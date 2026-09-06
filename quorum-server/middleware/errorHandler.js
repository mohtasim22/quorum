const { Prisma } = require('../generated/prisma');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      const target = err.meta?.target;
      message = `Duplicate value for: ${Array.isArray(target) ? target.join(', ') : target}`;
    } else if (err.code === 'P2025') {
      status = 404;
      message = 'Not found';
    }
  }

  if (status >= 500) console.error(err);

  res.status(status).json({ message });
};

module.exports = errorHandler;
