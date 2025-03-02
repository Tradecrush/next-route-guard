import { baseESLintConfig } from '@tradecrush/eslint-config/base-eslint-config';

const routeAuthESLintConfig = [
  ...baseESLintConfig,
  {
    ignores: ['./dist'],
    files: ['**/*.ts', '**/*.js']
  },
  // Node.js environment specifically for script files
  {
    files: ['**/scripts/**/*.js', '**/scripts/**/*.ts', '**/tests/**/*.test.js', '**/tests/**/*.js'],
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
        exports: 'writable',
        // Add Node.js globals
        Buffer: 'readonly',
        setImmediate: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',
        // Add test globals
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        // Add browser globals for tests
        URL: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: {
      // Allow require statements in scripts and tests
      '@typescript-eslint/no-require-imports': 'off',
      // Disable unused variables check for tests and scripts
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
];

export default routeAuthESLintConfig;
