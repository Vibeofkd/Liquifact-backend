const AppError = require('../errors/AppError');
const { error: buildErrorResponse } = require('../utils/responseHelper');

/**
 * Global error handling middleware
 * Ensures consistent error responses and prevents stack leaks in production.
 *
 * @param {Error & { statusCode?: number }} err Error object.
 * @param {import('express').Request} req Express request object.
 * @param {import('express').Response} res Express response object.
 * @param {import('express').NextFunction} _next Express next middleware function.
 * @returns {void}
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  if (!(err instanceof AppError)) {
    console.error('Unhandled Error:', err);
  }

  let message;
  if (statusCode >= 500 && isProduction) {
    message = 'Internal server error';
  } else if (err instanceof AppError) {
    message = err.detail || err.title || 'Application error';
  } else {
    message = err.message || 'An unexpected error occurred while processing your request.';
  }

  let code = 'INTERNAL_ERROR';
  if (statusCode === 400) {
    code = 'BAD_REQUEST';
  } else if (statusCode === 401) {
    code = 'UNAUTHORIZED';
  } else if (statusCode === 403) {
    code = 'FORBIDDEN';
  } else if (statusCode === 404) {
    code = 'NOT_FOUND';
  }

  const details = isDevelopment ? err.stack || err.message : null;
  const payload = buildErrorResponse(message, code, details);
  res.header('Content-Type', 'application/problem+json');
  res.status(statusCode).json(payload);
}

module.exports = errorHandler;
