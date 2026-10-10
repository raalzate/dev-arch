#!/usr/bin/env node
// dev-arch doctor entry point (012-install-doctor-docker): `npm run doctor`, `npx dev-arch doctor`, `make check-env`.
// Node 20+, no dependencies beyond Node itself.
import { main } from './doctor.mjs';
import { realSystem } from './system.mjs';

const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const r = await main(process.argv.slice(2), realSystem(), color);
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exitCode = r.code;
