'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (config, { strapi }) => {
  const logFile = config.logFile || '/opt/app/logs/security-audit.log';
  const authPaths = config.authPaths || ['/api/auth', '/admin/login'];

  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  const isAuthPath = (pathname) => authPaths.some((p) => pathname.startsWith(p));
  const isForgotPassword = (pathname) =>
    ['/admin/forgot-password', '/api/auth/forgot-password'].some((p) => pathname.startsWith(p));

  const readResetToken = async (ctx) => {
    const pathname = ctx.request.path;
    const email = ctx.request.body && ctx.request.body.email;
    if (!email) return null;

    if (pathname.startsWith('/admin/forgot-password')) {
      const admin = await strapi.db
        .query('admin::user')
        .findOne({ where: { email }, select: ['resetPasswordToken'] });
      return admin ? admin.resetPasswordToken : null;
    }

    if (pathname.startsWith('/api/auth/forgot-password')) {
      const user = await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({ where: { email }, select: ['resetPasswordToken'] });
      return user ? user.resetPasswordToken : null;
    }

    return null;
  };

  return async (ctx, next) => {
    if (!isAuthPath(ctx.request.path)) {
      return next();
    }

    const startedAt = Date.now();
    const body = ctx.request.body || {};
    const email = body.email || body.identifier || '-';

    let error = null;
    try {
      await next();
    } catch (err) {
      error = err;
    }

    const recordStatus = error && error.status ? error.status : ctx.status;
    const record = {
      ts: new Date().toISOString(),
      event: 'password-flow',
      method: ctx.method,
      path: ctx.request.path,
      ip: ctx.request.ip,
      email,
      userAgent: ctx.request.headers['user-agent'] || '-',
      status: recordStatus,
      latencyMs: Date.now() - startedAt,
      result: recordStatus < 400 ? 'success' : 'failure',
    };

    if (isForgotPassword(ctx.request.path)) {
      try {
        const hasToken = Boolean(await readResetToken(ctx));
        if (hasToken) {
          strapi.log.info(`[reset-token] ${ctx.request.path} -> ${email} -> token generated (use reset-token.ps1)`);
        } else {
          strapi.log.warn(`[reset-token] ${ctx.request.path} -> ${email} -> no token in DB`);
        }
      } catch (err) {
        strapi.log.warn(`[reset-token] lookup failed: ${err.message}`);
      }
    }

    try {
      fs.appendFileSync(logFile, JSON.stringify(record) + '\n');
    } catch (err) {
      strapi.log.warn(`[audit-log] write failed: ${err.message}`);
    }

    if (error) {
      throw error;
    }
  };
};