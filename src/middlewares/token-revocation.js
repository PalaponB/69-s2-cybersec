'use strict';

module.exports = (config, { strapi }) => {
  const maxClockSkew = config.maxClockSkewSeconds || 0;
  const skipPaths = config.skipPaths || ['/api/auth'];

  let jwt = null;
  try {
    jwt = require('jsonwebtoken');
  } catch (err) {
    strapi.log.warn('[token-revocation] jsonwebtoken library unavailable; guard disabled');
  }

  const isAuthedApiPath = (pathname) =>
    pathname.startsWith('/api/') && !skipPaths.some((p) => pathname.startsWith(p));

  const isAdminPath = (pathname) =>
    pathname.startsWith('/admin/') &&
    !['/admin/login', '/admin/forgot-password', '/admin/reset-password', '/admin/register-admin'].some(
      (p) => pathname.startsWith(p)
    );

  const decode = (token, secret) => {
    if (!jwt || !token || !secret) return null;
    try {
      return jwt.verify(token, secret);
    } catch (err) {
      return null;
    }
  };

  const modifiedSince = (updatedAt, iat) => {
    if (!updatedAt) return false;
    const ms = Date.parse(updatedAt);
    if (Number.isNaN(ms)) return false;
    return ms / 1000 > (iat || 0) + maxClockSkew;
  };

  const lookup = async (uid, id) => {
    try {
      return await strapi.db.query(uid).findOne({ where: { id } });
    } catch (err) {
      return null;
    }
  };

  const reject = (ctx) => {
    ctx.status = 401;
    ctx.body = {
      data: null,
      error: {
        status: 401,
        name: 'UnauthorizedError',
        message: 'Invalid token, please log in again.',
        details: {},
      },
    };
  };

  return async (ctx, next) => {
    const header = ctx.request.headers.authorization;
    if (!jwt || typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return next();
    }
    const raw = header.slice(7).trim();
    if (!raw) {
      return next();
    }

    if (isAuthedApiPath(ctx.request.path)) {
      const payload = decode(raw, process.env.JWT_SECRET);
      if (!payload || payload.id === undefined) {
        return next();
      }
      const user = await lookup('plugin::users-permissions.user', payload.id);
      if (!user || user.blocked === true || modifiedSince(user.updatedAt, payload.iat)) {
        return reject(ctx);
      }
      return next();
    }

    if (isAdminPath(ctx.request.path)) {
      const payload = decode(raw, process.env.ADMIN_JWT_SECRET);
      if (!payload || payload.id === undefined) {
        return next();
      }
      const adminUser = await lookup('admin::user', payload.id);
      if (!adminUser || adminUser.isActive === false || modifiedSince(adminUser.updatedAt, payload.iat)) {
        return reject(ctx);
      }
      return next();
    }

    return next();
  };
};