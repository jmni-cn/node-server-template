/**
 * 本地 ESLint 规则插件 barrel。
 *
 * 以 flat config 插件形式导出三条规则，规则名见 README。
 */
import noAppRepositoryImport = require('./no-app-repository-import');
import noEntityResponse = require('./no-entity-response');
import noCrossAppImport = require('./no-cross-app-import');

const plugin = {
  meta: { name: 'local-rules', version: '0.0.1' },
  rules: {
    'no-app-repository-import': noAppRepositoryImport,
    'no-entity-response': noEntityResponse,
    'no-cross-app-import': noCrossAppImport,
  },
};

export = plugin;
