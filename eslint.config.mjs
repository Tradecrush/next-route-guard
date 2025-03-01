import { baseESLintConfig } from '@tradecrush/eslint-config/base-eslint-config';

const routeAuthESLintConfig = [
  ...baseESLintConfig,
  {
    ignores: ['./dist', 'test/test-app', 'test/test-app-advanced'],
    files: ['**/*.ts', '**/*.js']
  },
  // Node.js environment specifically for script files
  {
    files: ['**/scripts/**/*.js', '**/scripts/**/*.ts', '**/test/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
        clearTimeout: 'readonly',
        setTimeout: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        exports: 'writable'
      },
      environments: {
        node: true
      }
    }
  }
];

export default routeAuthESLintConfig;
