const path = require('path');

module.exports = {
  apps: [
    {
      name: 'marcadors',
      script: path.join(__dirname, 'server.js'),
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        BASE_PATH: '/marcadores',
        PUBLIC_PATH: '/marcadores',
        LOG_LEVEL: 'info',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(__dirname, 'logs', 'error.log'),
      out_file: path.join(__dirname, 'logs', 'out.log'),
      merge_logs: true,
    },
  ],
};
