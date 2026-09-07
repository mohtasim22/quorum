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

  req[source] = result.data;   // parsed, coerced, and stripped
  next();
};

module.exports = validate;
