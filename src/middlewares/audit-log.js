'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (config, { strapi }) => {
  const logFile = config.logFile || '/opt/app/logs/security-audit.log';
  const authPaths = config.authPaths || ['/api/auth', '/admin/login'];

  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  const isAuthPath = (pathname) => authPaths.some((p) => pathname.startsWith(p));

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