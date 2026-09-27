'use strict';

module.exports = (config, { strapi }) => {
  const authPaths = config.authPaths || ['/api/auth/local', '/admin/login'];
  const maxFailures = config.maxFailures || 5;
  const windowMs = config.windowMs || 15 * 60 * 1000;
  const lockoutMs = config.lockoutMs || 15 * 60 * 1000;
  const store = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.lockUntil && entry.lockUntil <= now) {
        entry.lockUntil = 0;
        entry.failures = 0;
        entry.updatedAt = now;
      } else if (!entry.lockUntil && entry.updatedAt && entry.updatedAt + windowMs <= now) {
        store.delete(key);
      } else if (entry.lockUntil && entry.lockUntil + lockoutMs <= now) {
        store.delete(key);
      }
    }
  }, Math.min(Math.floor(windowMs / 2), Math.floor(lockoutMs / 2)));
  if (timer.unref) timer.unref();

  const isTarget = (pathname) => authPaths.some((p) => pathname.startsWith(p));

  const normalizeIdentifier = (body) => {
    if (!body || typeof body !== 'object') return '';
    const value = body.identifier || body.email || '';
    return typeof value === 'string' ? value.toLowerCase().trim() : '';
  };

  const reject = (ctx, lockUntil) => {
    ctx.status = 429;
    ctx.body = {
      data: null,
      error: {
        status: 429,
        name: 'TooManyRequests',
        message: 'Too many failed attempts, please try again later.',
      },
    };
    ctx.set('Retry-After', String(Math.max(1, Math.ceil((lockUntil - Date.now()) / 1000))));
  };

  const recordOutcome = (identifier, finalStatus) => {
    if (finalStatus >= 200 && finalStatus < 300) {
      store.delete(identifier);
      return;
    }
    if (finalStatus === 400 || finalStatus === 401 || finalStatus === 403) {
      const entry = store.get(identifier) || { failures: 0, lockUntil: 0, updatedAt: Date.now() };
      entry.failures += 1;
      entry.updatedAt = Date.now();
      if (entry.failures >= maxFailures && !entry.lockUntil) {
        entry.lockUntil = Date.now() + lockoutMs;
        entry.failures = 0;
      }
      store.set(identifier, entry);
    }
  };

  return async (ctx, next) => {
    if (!isTarget(ctx.request.path)) {
      return next();
    }

    const identifier = normalizeIdentifier(ctx.request.body);
    if (!identifier) {
      return next();
    }

    const current = store.get(identifier) || { failures: 0, lockUntil: 0, updatedAt: 0 };
    if (current.lockUntil > Date.now()) {
      return reject(ctx, current.lockUntil);
    }

    let thrown = null;
    try {
      await next();
    } catch (err) {
      thrown = err;
    }

    if (ctx.res.writableEnded) {
      recordOutcome(identifier, ctx.status || 500);
    } else {
      ctx.res.once('finish', () => recordOutcome(identifier, ctx.status || 500));
    }

    if (thrown) {
      throw thrown;
    }
    return undefined;
  };
};