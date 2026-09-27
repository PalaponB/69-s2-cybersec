'use strict';

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'abcdefgh',
  'admin123',
  'letmein',
  'welcome123',
  'welcome1',
  'iloveyou',
  'monkey123',
  'football',
  'abc12345',
  '123456789a',
]);

module.exports = (config, { strapi }) => {
  const targets = config.paths || [
    '/api/auth/local/register',
    '/api/auth/reset-password',
    '/api/auth/change-password',
    '/admin/register-admin',
    '/admin/reset-password',
    '/admin/change-password',
  ];
  const minLength = config.minLength || 8;
  const maxLength = config.maxLength || 128;

  const normalizePath = (pathname) => String(pathname || '').replace(/\/+$/, '');

  const isTarget = (pathname) => targets.some((p) => normalizePath(p) === normalizePath(pathname));

  const passwordField = (pathname, body) => {
    const p = normalizePath(pathname);
    if (p === '/admin/reset-password') return body.resetPasswordToken ? body.password : null;
    if (p === '/api/auth/reset-password') return body.code ? body.password : null;
    if (p === '/api/auth/change-password' || p === '/admin/change-password') {
      return body.currentPassword || body.password ? body.password : null;
    }
    if (p === '/admin/register-admin' || p === '/api/auth/local/register') {
      return typeof body.password === 'string' ? body.password : null;
    }
    return null;
  };

  const identityParts = (body) => {
    const parts = [];
    const push = (value) => {
      if (typeof value === 'string' && value.trim()) {
        parts.push(value.toLowerCase().replace(/\s+/g, ''));
      }
    };
    push(body.username);
    push(body.email && body.email.split('@')[0]);
    push(body.firstname);
    push(body.lastname);
    return parts;
  };

  const describe = (password, body) => {
    const issues = [];
    if (typeof password !== 'string' || password.length === 0) {
      issues.push('a value');
      return issues;
    }
    if (password.length < minLength) issues.push(`at least ${minLength} characters`);
    if (password.length > maxLength) issues.push(`at most ${maxLength} characters`);
    if (!/[a-z]/.test(password)) issues.push('a lowercase letter');
    if (!/[A-Z]/.test(password)) issues.push('an uppercase letter');
    if (!/[0-9]/.test(password)) issues.push('a digit');
    if (!/[^A-Za-z0-9]/.test(password)) issues.push('a special character (e.g. !@#$%^&*)');
    if (/(.)\1{2,}/.test(password)) issues.push('no 3 or more repeated characters in a row');
    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower)) issues.push('not a commonly used password');
    if (COMMON_PASSWORDS.has(lower.replace(/[^a-z0-9]/g, ''))) issues.push('not a commonly used password');
    for (const part of identityParts(body)) {
      if (part && part.length >= 4 && lower.includes(part)) {
        issues.push('not include your name, username or email');
        break;
      }
    }
    return issues;
  };

  return async (ctx, next) => {
    if (ctx.method !== 'POST' || !isTarget(ctx.request.path)) {
      return next();
    }

    const body = ctx.request.body || {};
    const password = passwordField(ctx.request.path, body);

    if (password === null || password === undefined) {
      return next();
    }

    const issues = describe(password, body);
    if (issues.length === 0) {
      return next();
    }

    ctx.status = 400;
    ctx.body = {
      data: null,
      error: {
        status: 400,
        name: 'ValidationError',
        message: `password must ${issues.join(', ')}`,
        details: {},
      },
    };
  };
};