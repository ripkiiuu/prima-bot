module.exports = {
  apps: [
    {
      name: 'wa-bot-premium',
      script: 'index.js',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      time: true,
      restart_delay: 5000,
      kill_timeout: 10000,
      max_memory_restart: '700M',
      env: {
        NODE_ENV: 'production',
        WWEBJS_CLIENT_ID: 'wa-bot-premium',
        WWEBJS_DATA_PATH: '.wwebjs_auth',
        PUPPETEER_HEADLESS: 'true',
      },
    },
  ],
};
