// Per-scenario state shared by the step definitions of 006.
import { After, setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import { rmSync } from 'node:fs';
import type { Background, RunResult } from './process.ts';

export class DevArchWorld extends World {
  /** Directory of the monorepo checkout the scenario works on (clean clone or the checkout under test). */
  monorepo = '';
  /** Product root inside `monorepo`. */
  product = '';
  /** Commit under test. */
  commit = '';
  result: RunResult | null = null;
  results: Record<string, RunResult> = {};
  env: NodeJS.ProcessEnv = {};
  data: Record<string, unknown> = {};
  servers: Background[] = [];
  cleanup: string[] = [];

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(DevArchWorld);

After(async function (this: DevArchWorld) {
  for (const server of this.servers) await server.stop();
  for (const dir of this.cleanup) rmSync(dir, { recursive: true, force: true });
});
