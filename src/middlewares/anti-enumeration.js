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
    } catch (err) {
      strapi.log.warn(`[anti-enum] normalized ${ctx.request.path}: ${err.message}`);
    }

    ctx.status = 200;
    ctx.body = { ok: true };
    return undefined;
  };
};