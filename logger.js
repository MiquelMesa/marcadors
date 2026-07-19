const pino = require('pino');

const transportOpts = (() => {
  try {
    require.resolve('pino-pretty');
    return {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    };
  } catch {
    return {};
  }
})();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...transportOpts,
});

module.exports = logger;
