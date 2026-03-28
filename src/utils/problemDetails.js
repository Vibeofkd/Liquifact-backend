/**
 * RFC 7807 (Problem Details for HTTP APIs) Formatter.
 * Takes error data and formats it into a standard JSON object.
 *
 * @param {Object}  root0              - Destructured parameters.
 * @param {string}  root0.type         - A URI reference identifying the problem type.
 * @param {string}  root0.title        - A short, human-readable summary of the problem.
 * @param {number}  root0.status       - The HTTP status code.
 * @param {string}  [root0.detail]     - A human-readable explanation of this occurrence.
 * @param {string}  [root0.instance]   - A URI reference identifying this specific occurrence.
 * @param {string}  [root0.stack]      - Stack trace (omitted in production).
 * @param {boolean} [root0.isProduction] - When true, omits the stack trace.
 * @returns {Object} RFC 7807 problem details object.
 */
function formatProblemDetails({
  type = 'about:blank',
  title = 'An unexpected error occurred',
  status = 500,
  detail,
  instance,
  stack,
  isProduction = process.env.NODE_ENV === 'production',
}) {
  const problem = {
    type,
    title,
    status,
    detail,
    instance,
  };

  // Only include stack trace if NOT in production for security reasons
  if (!isProduction && stack) {
    problem.stack = stack;
  }

  return problem;
}

module.exports = formatProblemDetails;
