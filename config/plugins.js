module.exports = ({ env }) => ({
  email: {
    config: {
      provider: '/opt/app/config/email-provider',
      providerOptions: {},
      settings: {
        defaultFrom: 'no-reply@strapi.io',
        defaultReplyTo: 'no-reply@strapi.io',
      },
    },
  },
});