/* global console, process */
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  console.log('Git hooks not installed: this checkout is not a Git worktree.');
  process.exit(0);
}

execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
  stdio: 'inherit',
});
console.log('Installed BRIGX Git hooks from .githooks/.');
