const { Prisma } = require("../generated/prisma");

// "Vote_userId_questionId_key" → "userId, questionId"
const fieldsFromIndex = (index = "") =>
  String(index).replace(/_key$/, "").split("_").slice(1).join(", ");

// pull vote_one_target out of: violates check constraint "vote_one_target"
const checkNameFrom = (msg = "") =>
  (String(msg).match(/check constraint "([^"]+)"/) || [])[1];

const CHECK_MESSAGES = {
  vote_one_target: "A vote must target exactly one question or answer",
  vote_value_valid: "A vote must be either +1 or -1",
  comment_one_parent: "A comment must belong to exactly one question or answer",
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // errors we threw ourselves, e.g. { status: 403, message: '...' }
  const own = err.status || err.statusCode;
  if (own && own < 500) {
    return res.status(own).json({
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = /** @type {any} */ (err.meta) ?? {};
    const cause = meta.driverAdapterError?.cause;

    if (err.code === "P2002") {
      const fields =
        (Array.isArray(err.meta?.target) && err.meta.target.join(", ")) ||
        fieldsFromIndex(cause?.constraint?.index) ||
        "value";
      return res.status(409).json({ message: `Already taken: ${fields}` });
    }

    if (err.code === "P2025") {
      return res.status(404).json({ message: "Not found" });
    }

    if (err.code === "P2003") {
      return res
        .status(400)
        .json({ message: "Referenced record does not exist" });
    }

    if (err.code === "P2039" || cause?.code === "23514") {
      const name = checkNameFrom(cause?.originalMessage ?? cause?.message);
      return res.status(400).json({
        message: CHECK_MESSAGES[name] || "Request violates a data constraint",
      });
    }
  }

  // wrong shape passed to Prisma — a bug in our code, not the client's fault,
  // but never echo it: the message contains the schema
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(err);
    return res.status(400).json({ message: "Malformed request data" });
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
};

module.exports = errorHandler;
