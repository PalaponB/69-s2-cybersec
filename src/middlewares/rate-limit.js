'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (config, { strapi }) => {
  const authPaths = config.authPaths || ['/api/auth', '/admin/login'];
  const max = config.max || 10;
  const windowMs = config.windowMs || 60 * 1000;
  const buckets = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, windowMs);
  if (timer.unref) timer.unref();

  const isAuthPath = (pathname) => authPaths.some((p) => pathname.startsWith(p));

  return async (ctx, next) => {
    if (!isAuthPath(ctx.request.path)) {
      return next();
    }

    const key = `${ctx.request.ip}:${ctx.request.path}`;
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;

    ctx.set('X-RateLimit-Limit', String(max));
    ctx.set('X-RateLimit-Remaining', String(Math.max(max - entry.count, 0)));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      ctx.set('Retry-After', String(retryAfter));
      ctx.status = 429;
      ctx.body = {
        data: null,
        error: {
          status: 429,
          name: 'TooManyRequests',
          message: 'Too many authentication attempts, please retry later.',
        },
      };
      return;
    }

    return next();
  };
};