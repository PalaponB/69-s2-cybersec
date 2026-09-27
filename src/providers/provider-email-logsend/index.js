'use strict';

const extractResetCode = (payload) => {
  if (typeof payload !== 'string') return null;
  const m = payload.match(/[?&]code=([a-f0-9]+)/i);
  return m ? m[1] : null;
};

module.exports = {
  init: (providerOptions = {}, settings = {}) => {
    const from = settings && settings.defaultFrom;
    return {
      send: async (options) => {
        const code =
          extractResetCode(options.text) ||
          extractResetCode(options.html) ||
          extractResetCode(options.url);
        const loggingEnabled = process.env.LOG_RESET_TOKEN === 'true';
        if (code && loggingEnabled) {
          console.log(
            `[reset-token] forgot-password -> ${options.to} -> code=${code} (dev only; LOG_RESET_TOKEN=true)`
          );
        }
        console.log(`[email-log] no-op send -> ${options.to} (${options.subject}) from=${from}`);
        return true;
      },
      sendTemplatedEmail: async (template, options) => {
        console.log(`[email-log] no-op templated -> ${options.to}`);
        return true;
      },
    };
  },
};