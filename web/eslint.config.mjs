// Lint configuration of the web (011-quality-delivery, FR-004, research D2): the Next.js recommended rules for
// Core Web Vitals through the flat-config compatibility layer. `next build` and `make test-web` run it blocking.
import Module, { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// npm keeps `next` under web/node_modules while eslint-config-next is hoisted to the workspace root, so its parser
// cannot find `next/dist/compiled/babel/eslint-parser`. Resolve that one request to the web's own Next.js (the same
// resolution hook eslint-config-next itself installs for its plugins).
const require = createRequire(import.meta.url);
const BABEL_PARSER = 'next/dist/compiled/babel/eslint-parser';
const babelParser = require.resolve(BABEL_PARSER);
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return resolveFilename.call(this, request === BABEL_PARSER ? babelParser : request, ...rest);
};

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', 'engine-dist/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
];
