'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (config, { strapi }) => {
  const logFile = config.logFile || '/opt/app/logs/security-audit.log';
  const authPaths = config.authPaths || ['/api/auth', '/admin/login'];
  const maxBytes = config.maxBytes || 5 * 1024 * 1024;

  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  const rotate = () => {
    try {
      if (fs.existsSync(logFile) && fs.statSync(logFile).size >= maxBytes) {
        fs.renameSync(logFile, `${logFile}.1`);
      }
    } catch (err) {
      strapi.log.warn(`[audit-log] rotate failed: ${err.message}`);
    }
  };

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

    const record = {
      ts: new Date().toISOString(),
      event: 'password-flow',
      method: ctx.method,
      path: ctx.request.path,
      ip: ctx.request.ip,
      email,
      userAgent: ctx.request.headers['user-agent'] || '-',
      status: 0,
      latencyMs: 0,
      result: 'n/a',
    };

    const write = () => {
      record.status = ctx.status || 500;
      record.latencyMs = Date.now() - startedAt;
      record.result = record.status < 400 ? 'success' : 'failure';
      try {
        rotate();
        fs.appendFileSync(logFile, JSON.stringify(record) + '\n');
      } catch (err) {
        strapi.log.warn(`[audit-log] write failed: ${err.message}`);
      }
    };

    if (ctx.res.writableEnded) {
      write();
    } else {
      ctx.res.once('finish', write);
    }

    if (error) {
      throw error;
    }
  };
};