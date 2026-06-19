// Portable ESLint preset (flat config) — in-editor guards for the bug classes found
// during the Ternity production-readiness work. Uses only the built-in `no-restricted-syntax`
// rule, so there is NO custom plugin to install — drop the folder in, spread the export.
//
// Usage in a consuming project's eslint.config.js:
//
//   import ternityGuards from './tooling/eslint/index.js';
//   export default [ ...existingConfig, ...ternityGuards ];
//
// Requires the typescript-eslint parser to be active for the linted files (so the TS
// AST nodes the selectors below target are produced). Static, recognisable shapes only —
// logic bugs belong to tests + mutation testing.

/** Layer that applies to any TypeScript backend (Fastify request handling). */
export const backendGuards = {
  name: 'ternity/backend-guards',
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        // S4: casting request.body skips runtime validation → malformed input 500s
        // instead of returning 400. Validate with a Zod schema (.parse/.safeParse).
        selector:
          'TSAsExpression[expression.type="MemberExpression"][expression.object.name="request"][expression.property.name="body"]',
        message:
          'Do not cast request.body with `as` — validate it with a Zod schema (.parse/.safeParse) so malformed input returns 400, not 500.',
      },
    ],
  },
};

/** The full preset (spread into a flat config). Add more layers here over time. */
export default [backendGuards];
