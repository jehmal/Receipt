// ESLint Security Configuration for Receipt Vault Pro Backend
// Enhanced security rules to catch common vulnerabilities

module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:security/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  plugins: [
    'security',
    'no-unsanitized',
    '@typescript-eslint'
  ],
  env: {
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  rules: {
    // Security-specific rules
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'error',

    // No unsanitized content
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',

    // General security best practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-alert': 'error',
    'no-console': 'warn',

    // TypeScript security rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',

    // Custom Receipt Vault Pro security rules
    'receipt-vault-security/no-hardcoded-secrets': 'error',
    'receipt-vault-security/secure-random': 'error',
    'receipt-vault-security/validate-input': 'error',
    'receipt-vault-security/no-sql-injection': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
      rules: {
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-child-process': 'off',
        'no-console': 'off'
      }
    }
  ]
};

// Custom ESLint rules specific to Receipt Vault Pro
const receiptVaultSecurityRules = {
  'receipt-vault-security/no-hardcoded-secrets': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow hardcoded secrets in code',
        category: 'Security',
        recommended: true
      },
      schema: []
    },
    create(context) {
      const suspiciousPatterns = [
        /password\s*[:=]\s*['"][^'"]+['"]/i,
        /secret\s*[:=]\s*['"][^'"]+['"]/i,
        /token\s*[:=]\s*['"][^'"]+['"]/i,
        /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
        /database[_-]?url\s*[:=]\s*['"][^'"]+['"]/i
      ];

      return {
        Literal(node) {
          if (typeof node.value === 'string') {
            for (const pattern of suspiciousPatterns) {
              if (pattern.test(node.raw)) {
                context.report({
                  node,
                  message: 'Potential hardcoded secret detected. Use environment variables instead.'
                });
              }
            }
          }
        }
      };
    }
  },

  'receipt-vault-security/secure-random': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Enforce use of cryptographically secure random functions',
        category: 'Security',
        recommended: true
      },
      schema: []
    },
    create(context) {
      return {
        CallExpression(node) {
          if (
            node.callee.type === 'MemberExpression' &&
            node.callee.object.name === 'Math' &&
            node.callee.property.name === 'random'
          ) {
            context.report({
              node,
              message: 'Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive random values.'
            });
          }
        }
      };
    }
  },

  'receipt-vault-security/validate-input': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Require input validation for API endpoints',
        category: 'Security',
        recommended: true
      },
      schema: []
    },
    create(context) {
      return {
        FunctionDeclaration(node) {
          if (
            node.params.some(param => 
              param.type === 'Identifier' && 
              ['request', 'req', 'body', 'query', 'params'].includes(param.name)
            )
          ) {
            // Check if validation is present
            const hasValidation = node.body.body.some(stmt => {
              return stmt.type === 'ExpressionStatement' &&
                     stmt.expression.type === 'CallExpression' &&
                     stmt.expression.callee.name &&
                     stmt.expression.callee.name.includes('validate');
            });

            if (!hasValidation) {
              context.report({
                node,
                message: 'API endpoint functions should include input validation.'
              });
            }
          }
        }
      };
    }
  },

  'receipt-vault-security/no-sql-injection': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Prevent SQL injection vulnerabilities',
        category: 'Security',
        recommended: true
      },
      schema: []
    },
    create(context) {
      const dangerousPatterns = [
        /\$\{[^}]*\}/,  // Template literal interpolation
        /'\s*\+\s*[a-zA-Z]/,  // String concatenation
        /"\s*\+\s*[a-zA-Z]/   // String concatenation
      ];

      return {
        TemplateLiteral(node) {
          if (node.quasis.some(quasi => {
            return quasi.value.raw.toLowerCase().includes('select') ||
                   quasi.value.raw.toLowerCase().includes('insert') ||
                   quasi.value.raw.toLowerCase().includes('update') ||
                   quasi.value.raw.toLowerCase().includes('delete');
          })) {
            context.report({
              node,
              message: 'Potential SQL injection vulnerability. Use parameterized queries.'
            });
          }
        },
        
        BinaryExpression(node) {
          if (node.operator === '+' && 
              node.left.type === 'Literal' && 
              typeof node.left.value === 'string' &&
              node.left.value.toLowerCase().match(/(select|insert|update|delete)/)) {
            context.report({
              node,
              message: 'Potential SQL injection vulnerability. Use parameterized queries.'
            });
          }
        }
      };
    }
  }
};

module.exports.rules = receiptVaultSecurityRules;