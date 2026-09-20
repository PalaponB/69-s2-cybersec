'use strict';

module.exports = (config, { strapi }) => {
  const targets = config.paths || ['/api/auth/forgot-password'];

  const isTarget = (pathname) => targets.some((p) => pathname === p);

  return async (ctx, next) => {
    if (!isTarget(ctx.request.path)) {
      return next();
    }

    try {
      await next();
      if (ctx.status === 404) {
        ctx.status = 200;
        ctx.body = { ok: true };
      }
      return undefined;
    } catch (err) {
      if (err && (err.status === 404 || String(err.message).toLowerCase().includes('not found'))) {
        ctx.status = 200;
        ctx.body = { ok: true };
        return undefined;
      }
      throw err;
    }
  };
};