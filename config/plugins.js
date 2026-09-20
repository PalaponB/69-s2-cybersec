module.exports = ({ env }) => ({
  email: {
    config: {
      provider: '@strapi/provider-email-sendmail',
      providerOptions: {},
      settings: {
        defaultFrom: env('EMAIL_FROM', 'no-reply@strapi.io'),
        defaultReplyTo: env('EMAIL_REPLY_TO', 'no-reply@strapi.io'),
      },
    },
  },
});