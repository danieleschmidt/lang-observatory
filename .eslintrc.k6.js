module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  globals: {
    // k6 global variables
    __ENV: 'readonly',
    __VU: 'readonly',
    __ITER: 'readonly',
    // k6 imports
    check: 'readonly',
    group: 'readonly',
    sleep: 'readonly',
    http: 'readonly',
    console: 'readonly',
  },
  rules: {
    'no-console': 'off', // k6 uses console.log
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  }
};