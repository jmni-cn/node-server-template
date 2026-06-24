const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

const lib = (group, name) => path.resolve(__dirname, `libs/${group}/${name}/src`);

module.exports = function (options) {
  const appName = process.env.APP_NAME || 'admin-api';
  const outputPath = path.resolve(__dirname, 'dist', 'apps', appName);
  const isWatchMode = options.watch;
  const plugins = [...(options.plugins || [])];

  if (isWatchMode) {
    plugins.push(new webpack.HotModuleReplacementPlugin());
  }

  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [
          /^@core\//,
          /^@platform\//,
          /^@domains\//,
          /^@integrations\//,
          /webpack\/hot/,
        ],
      }),
    ],
    resolve: {
      ...options.resolve,
      alias: {
        ...options.resolve?.alias,
        '@core/common': lib('core', 'common'),
        '@core/config': lib('core', 'config'),
        '@core/database': lib('core', 'database'),
        '@core/logger': lib('core', 'logger'),
        '@core/request-context': lib('core', 'request-context'),
        '@core/i18n': lib('core', 'i18n'),
        '@platform/auth': lib('platform', 'auth'),
        '@platform/security': lib('platform', 'security'),
        '@platform/cache': lib('platform', 'cache'),
        '@platform/queue': lib('platform', 'queue'),
        '@platform/audit': lib('platform', 'audit'),
        '@platform/task': lib('platform', 'task'),
        '@platform/health': lib('platform', 'health'),
        '@domains/identity': lib('domains', 'identity'),
        '@domains/access-control': lib('domains', 'access-control'),
        '@domains/system': lib('domains', 'system'),
        '@integrations/sso': lib('integrations', 'sso'),
      },
    },
    output: {
      ...options.output,
      path: outputPath,
      filename: 'main.js',
    },
    plugins,
  };
};
