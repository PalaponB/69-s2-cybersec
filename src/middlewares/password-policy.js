'use strict';

module.exports = (config, { strapi }) => {
  const targets = config.paths || [
    '/api/auth/local/register',
    '/api/auth/reset-password',
    '/api/auth/change-password',
    '/admin/register-admin',
    '/admin/reset-password',
  ];
  const minLength = config.minLength || 8;

  const isTarget = (pathname) => targets.some((p) => pathname === p);

  const passwordField = (pathname, body) => {
    if (pathname === '/admin/reset-password') return body.resetPasswordToken ? body.password : null;
    if (pathname === '/api/auth/reset-password') return body.code ? body.password : null;
    if (pathname === '/api/auth/change-password') return body.currentPassword || body.password ? body.password : null;
    if (pathname === '/admin/register-admin' || pathname === '/api/auth/local/register') {
      return typeof body.password === 'string' ? body.password : null;
    }
    return null;
  };

  const describe = (password) => {
    const issues = [];
    if (password.length < minLength) issues.push(`at least ${minLength} characters`);
    if (!/[a-z]/.test(password)) issues.push('a lowercase letter');
    if (!/[A-Z]/.test(password)) issues.push('an uppercase letter');
    if (!/[0-9]/.test(password)) issues.push('a digit');
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

    const issues = describe(String(password));
    if (issues.length === 0) {
      return next();
    }

    ctx.status = 400;
    ctx.body = {
      data: null,
      error: {
        status: 400,
        name: 'ValidationError',
        message: `password must contain ${issues.join(', ')}`,
        details: {},
      },
    };
  };
};