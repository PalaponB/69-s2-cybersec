'use strict';

const AUTH_PATHS = [
  '/api/auth',
  '/admin/login',
  '/admin/register-admin',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/admin/change-password',
];

module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  {
    name: 'global::token-revocation',
    config: {},
  },
  {
    name: 'global::anti-enumeration',
    config: {
      paths: [
        '/api/auth/forgot-password',
        '/api/auth/send-email-confirmation',
        '/admin/forgot-password',
      ],
    },
  },
  {
    name: 'global::audit-log',
    config: {
      logFile: '/opt/app/logs/security-audit.log',
      authPaths: AUTH_PATHS,
    },
  },
  {
    name: 'global::rate-limit',
    config: {
      authPaths: AUTH_PATHS,
      max: 10,
      globalMax: 30,
      windowMs: 60 * 1000,
    },
  },
  {
    name: 'global::account-lockout',
    config: {
      authPaths: ['/api/auth/local', '/admin/login'],
      maxFailures: 5,
      lockoutMs: 15 * 60 * 1000,
      windowMs: 15 * 60 * 1000,
    },
  },
  {
    name: 'global::password-policy',
    config: {
      minLength: 8,
    },
  },
];