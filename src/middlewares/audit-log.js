'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (config, { strapi }) => {
  const logFile = config.logFile || '/opt/app/logs/security-audit.log';
  const authPaths = config.authPaths || ['/api/auth', '/admin/login'];
  const maxBytes = config.maxBytes || 5 * 1024 * 1024;
  const backups = config.backups || 2;

  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  const sanitize = (value, maxLen) => {
    const s = String(value === undefined || value === null ? '-' : value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return s.length > maxLen ? s.slice(0, maxLen) : s || '-';
  };

  const rotate = () => {
    try {
      if (!fs.existsSync(logFile) || fs.statSync(logFile).size < maxBytes) {
        return;
      }
      for (let i = backups; i > 1; i -= 1) {
        const from = `${logFile}.${i - 1}`;
        const to = `${logFile}.${i}`;
        if (fs.existsSync(from)) {
          fs.renameSync(from, to);
        }
      }
      fs.renameSync(logFile, `${logFile}.1`);
    } catch (err) {
      strapi.log.warn(`[audit-log] rotate failed: ${err.message}`);
    }
  };

  const isAuthPath = (pathname) => authPaths.some((p) => pathname.startsWith(p));

  const actorType = (pathname) =>
    pathname.startsWith('/admin') ? 'admin' : pathname.startsWith('/api/auth') ? 'public' : 'other';

  const operation = (pathname, method) => {
    const p = pathname;
    if (p.endsWith('/forgot-password')) return 'forgot-password';
    if (p.endsWith('/reset-password')) return 'reset-password';
    if (p.endsWith('/change-password')) return 'change-password';
    if (p.endsWith('/register') || p.endsWith('/register-admin')) return 'register';
    if (p.endsWith('/local') || p.endsWith('/login')) return 'login';
    return `${method} ${pathname}`;
  };

  return async (ctx, next) => {
    if (!isAuthPath(ctx.request.path)) {
      return next();
    }

    const startedAt = Date.now();
    const body = ctx.request.body || {};
    const email = sanitize(body.email || body.identifier || '-', 254);

    let error = null;
    try {
      await next();
    } catch (err) {
      error = err;
    }

    const record = {
      ts: new Date().toISOString(),
      event: 'password-flow',
      operation: operation(ctx.request.path, ctx.method),
      actorType: actorType(ctx.request.path),
      method: ctx.method,
      path: ctx.request.path,
      ip: sanitize(ctx.request.ip, 64),
      email,
      userAgent: sanitize(ctx.request.headers['user-agent'], 254),
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