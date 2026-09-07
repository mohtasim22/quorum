/**
 * An Error carrying an HTTP status, which errorHandler reads.
 * Object.assign keeps the type as Error & { status: number }, so
 * checkJs is satisfied without a cast.
 *
 * @param {number} status
 * @param {string} message
 */
const httpError = (status, message) => Object.assign(new Error(message), { status });

module.exports = httpError;
