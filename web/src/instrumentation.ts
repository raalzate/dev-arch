// Next.js server start hook (007-native-engine-runtime): recovery of interrupted analyses, periodic cleanup of
// expired ones and the API exposure warning. Runs only in the Node.js runtime.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startRuntime } = await import('./server/runtime');
  await startRuntime();
}
