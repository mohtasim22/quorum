const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for: ${Object.keys(err.keyPattern).join(', ')}`;
  }

  if (status >= 500) console.error(err);

  res.status(status).json({ message });
};

module.exports = errorHandler;
