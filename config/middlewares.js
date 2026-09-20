'use strict';

const AUTH_PATHS = [
  '/api/auth',
  '/admin/login',
  '/admin/register-admin',
  '/admin/forgot-password',
  '/admin/reset-password',
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
    name: 'global::anti-enumeration',
    config: {
      paths: ['/api/auth/forgot-password'],
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
      windowMs: 60 * 1000,
    },
  },
];