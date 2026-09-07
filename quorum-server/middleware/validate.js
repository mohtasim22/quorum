const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      details: result.error.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      })),
    });
  }

  // Express 5 defines req.query as a getter-only accessor on the prototype, so
  // `req.query = ...` silently no-ops. Define an own property to shadow it.
  Object.defineProperty(req, source, {
    value: result.data,          // parsed, coerced, and stripped
    writable: true,
    configurable: true,
    enumerable: true,
  });

  next();
};

module.exports = validate;
