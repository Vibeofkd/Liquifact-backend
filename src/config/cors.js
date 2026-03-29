/**
 * @fileoverview CORS allowlist parsing and policy for the LiquiFact API.
 *
 * Reads trusted origins from the `CORS_ALLOWED_ORIGINS` environment variable
 * (comma-separated list of exact origins) and builds an `options` object
 * compatible with the `cors` npm package.
 *
 * Behaviour summary:
 *   - Requests with **no Origin header** (curl, Postman, server-to-server) are
 *     always allowed — the `origin` callback receives `undefined` and passes.
 *   - Requests from an **allowed origin** receive normal CORS response headers.
 *   - Requests from a **disallowed origin** receive a 403 Forbidden response
 *     via a dedicated `Error` whose `.isCorsOriginRejected` flag is `true`.
 *   - In `NODE_ENV=development`, when `CORS_ALLOWED_ORIGINS` is not set, a set
 *     of common local development origins is permitted automatically.
 *   - In all other environments, when `CORS_ALLOWED_ORIGINS` is not set, every
 *     browser origin is denied.
 *
 * @module config/cors
 */

'use strict';

/** @type {string} Message for CORS rejection errors. */
const CORS_REJECTION_MESSAGE = 'Origin not allowed by CORS';

/** @type {string[]} Origins allowed when no env var is set during development. */
const DEV_DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/**
 * Parses `CORS_ALLOWED_ORIGINS` into a trimmed, de-duplicated array of origin
 * strings. Returns `null` when the variable is absent or blank.
 *
 * @param {string|undefined} raw - Raw value of the environment variable.
 * @returns {string[]|null} Array of allowed origins, or `null` if unset.
 */
function parseAllowedOrigins(raw) {
  if (!raw || raw.trim() === '') {
    return [];
  }

  return [
    ...new Set(
      raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    ),
  ];
}

/**
 * Returns the built-in localhost allowlist used when development mode has no
 * explicit CORS configuration.
 *
 * @returns {string[]} Local development origins.
 */
function getDevelopmentFallbackOrigins() {
  return [...DEV_DEFAULT_ORIGINS];
}

/**
 * Resolves the effective origin allowlist given the current environment.
 *
 * @param {NodeJS.ProcessEnv} env - Environment variables.
 * @returns {string[]} Allowlist to enforce.
 */
function getAllowedOriginsFromEnv(env = process.env) {
  const fromEnv = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  if (fromEnv.length > 0) {
    return fromEnv;
  }

  if (env.NODE_ENV === 'development') {
    return DEV_DEFAULT_ORIGINS;
  }

  // Production / test with no CORS_ALLOWED_ORIGINS → deny all browser origins.
  return [];
}

/**
 * Resolves the effective origin allowlist given the current environment.
 *
 * @returns {string[]|null} Allowlist to enforce, or `null` meaning "deny all
 *   browser origins" (production with no env var set).
 */
function resolveAllowlist() {
  const fromEnv = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
  if (fromEnv.length > 0) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === 'development') {
    return DEV_DEFAULT_ORIGINS;
  }

  // Production / test with no CORS_ALLOWED_ORIGINS → deny all browser origins.
  return null;
}

/**
 * Sentinel error thrown when an incoming `Origin` is not on the allowlist.
 * The `isCorsOriginRejected` flag lets downstream error handlers identify it
 * without `instanceof` checks across module boundaries.
 *
 * @param {string} origin - The rejected origin value.
 * @returns {Error} Annotated error instance.
 */
function createCorsRejectionError(origin) {
  const err = new Error(origin ? `CORS policy: origin "${origin}" is not allowed.` : CORS_REJECTION_MESSAGE);
  err.isCorsOriginRejected = true;
  err.status = 403;
  return err;
}

/**
 * Returns `true` if `err` is the dedicated blocked-origin CORS error produced
 * by {@link createCorsRejectionError}.
 *
 * @param {unknown} err - Value to test.
 * @returns {boolean}
 */
function isCorsOriginRejectedError(err) {
  return err !== null && err !== undefined && err.isCorsOriginRejected === true;
}

/**
 * Builds the options object for the `cors` middleware package.
 *
 * The `origin` callback implements exact-match checking against the resolved
 * allowlist. It calls `callback(null, true)` to approve an origin, and
 * `callback(err)` with the rejection error to deny it.
 *
 * @returns {import('cors').CorsOptions} Options ready to pass to `cors()`.
 *
 * @example
 * const cors = require('cors');
 * const { createCorsOptions } = require('./config/cors');
 * app.use(cors(createCorsOptions()));
 */
function createCorsOptions() {
  const allowlist = resolveAllowlist();

  return {
    /**
     * Validates request origin against the allowlist.
     *
     * @param {string|undefined} origin - Request origin.
     * @param {Function} callback - CORS callback.
     * @returns {void}
     */
    origin(origin, callback) {
      // Non-browser requests (no Origin header) are always allowed.
      if (origin === undefined) {
        return callback(null, true);
      }

      // No allowlist configured in production → deny.
      if (allowlist === null) {
        return callback(createCorsRejectionError(origin));
      }

      if (allowlist.includes(origin)) {
        return callback(null, true);
      }

      return callback(createCorsRejectionError(origin));
    },

    // Expose the standard headers clients need.
    optionsSuccessStatus: 200,
  };
}

module.exports = {
  CORS_REJECTION_MESSAGE,
  createCorsOptions,
  createCorsRejectionError,
  getAllowedOriginsFromEnv,
  getDevelopmentFallbackOrigins,
  isCorsOriginRejectedError,
  parseAllowedOrigins,
  resolveAllowlist,
  DEV_DEFAULT_ORIGINS,
};