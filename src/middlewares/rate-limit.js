'use strict';

module.exports = (config, { strapi }) => {
  const authPaths = config.authPaths || ['/api/auth', '/admin/login'];
  const max = config.max || 10;
  const globalMax = config.globalMax || 30;
  const windowMs = config.windowMs || 60 * 1000;
  const buckets = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.floor(windowMs / 2));
  if (timer.unref) timer.unref();

  const isAuthPath = (pathname) => authPaths.some((p) => pathname.startsWith(p));

  const consume = (key, limit, now) => {
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
    }
    entry.count += 1;
    buckets.set(key, entry);
    return entry.count > limit;
  };

  const reject = (ctx, now, resetAt) => {
    ctx.status = 429;
    ctx.body = {
      data: null,
      error: {
        status: 429,
        name: 'TooManyRequests',
        message: 'Too many authentication attempts, please retry later.',
      },
    };
    if (resetAt) {
      ctx.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - now) / 1000))));
    }
  };

  return async (ctx, next) => {
    if (!isAuthPath(ctx.request.path)) {
      return next();
    }

    const now = Date.now();
    const ipKey = `ip:${ctx.request.ip}`;
    const pathKey = `${ctx.request.ip}:${ctx.request.path}`;

    if (consume(ipKey, globalMax, now)) {
      const entry = buckets.get(ipKey);
      return reject(ctx, now, entry.resetAt);
    }
    if (consume(pathKey, max, now)) {
      const entry = buckets.get(pathKey);
      return reject(ctx, now, entry.resetAt);
    }

    let thrown = null;
    try {
      await next();
    } catch (err) {
      thrown = err;
    }

    const status = ctx.status || 500;
    if (status >= 200 && status < 300) {
      buckets.delete(ipKey);
      buckets.delete(pathKey);
    }

    if (thrown) {
      throw thrown;
    }
    return undefined;
  };
};