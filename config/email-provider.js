'use strict';

module.exports = {
  init(providerOptions = {}, settings = {}) {
    this.options = providerOptions;
    this.settings = settings;
    return this;
  },
  send(options) {
    strapi.log.info('[email] no-op provider received email', {
      to: options.to,
      subject: options.subject,
    });
    return Promise.resolve(true);
  },
};