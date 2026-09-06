// Cross-platform helper: runs a Python script with whichever interpreter exists
// (python3 on macOS/Linux, python or the py launcher on Windows).
import { spawnSync } from 'node:child_process';

const candidates = process.platform === 'win32' ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]];
const args = process.argv.slice(2);
for (const [cmd, pre] of candidates) {
  const probe = spawnSync(cmd, [...pre, '--version'], { stdio: 'ignore' });
  if (probe.status === 0) {
    const run = spawnSync(cmd, [...pre, ...args], { stdio: 'inherit' });
    process.exit(run.status ?? 1);
  }
}
console.error('No Python 3 interpreter found (tried: python3, python, py -3).');
process.exit(1);
