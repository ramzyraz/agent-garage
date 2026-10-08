import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

RUNNER = Path(__file__).with_name('run-builder-agent.py').resolve()
spec = importlib.util.spec_from_file_location('runner', RUNNER)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class FallbackTests(unittest.TestCase):
    def run_task(self, agent, task, claude='ok', codex='ok', missing=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ['npm', 'claude', 'codex']:
                script = root / name
                script.write_text('''#!/usr/bin/env python3
import os, sys
from pathlib import Path
name=Path(sys.argv[0]).name
if name == 'npm': sys.exit(0)
with open(os.environ['CALLS'], 'a') as f: f.write(name+'\\n')
mode=os.environ[name.upper()+'_MODE']
if mode == 'quota':
 print("You've hit your individual spend limit" if name == 'claude' else 'ERROR: usage_limit_reached')
 if os.environ['TASK'] == 'evaluate': Path('feedback.md').write_text('partial')
 sys.exit(0 if name == 'claude' else 1)
if mode == 'error': print('connection failed'); sys.exit(2)
if os.environ['TASK'] == 'evaluate': Path('feedback.md').write_text('complete')
''')
                script.chmod(0o755)
            env = {**os.environ, 'HOME': directory, 'PATH': directory + os.pathsep + os.environ['PATH'], 'GITHUB_OUTPUT': str(root/'output'), 'CALLS': str(root/'calls'), 'CLAUDE_MODE': claude, 'CODEX_MODE': codex, 'TASK': task, 'CLAUDE_CODE_OAUTH_TOKEN': 'fake', 'CODEX_AUTH_JSON': '{}'}
            if missing:
                env.pop('CODEX_AUTH_JSON' if missing == 'codex' else 'CLAUDE_CODE_OAUTH_TOKEN')
            # Avoid writing a shared auth checksum while exercising the runner.
            (root/'.codex').mkdir()
            (root/'.codex/auth.json').write_text('{}')
            result = subprocess.run(['python3', str(RUNNER), '--agent', agent, '--task', task, '--session', '16'], cwd=root, env=env, capture_output=True, text=True)
            return result.returncode, (root/'calls').read_text() if (root/'calls').exists() else '', (root/'output').read_text() if (root/'output').exists() else '', (root/'feedback.md').exists()

    def test_claude_quota_zero_exit_falls_back(self):
        code, calls, output, _ = self.run_task('claude', 'session', claude='quota')
        self.assertEqual((code, calls), (0, 'claude\ncodex\n'))
        self.assertIn('agent=codex\ncompleted=true', output)

    def test_codex_quota_falls_back(self):
        code, calls, _, _ = self.run_task('codex', 'session', codex='quota')
        self.assertEqual((code, calls), (0, 'codex\nclaude\n'))

    def test_both_exhausted_stops(self):
        code, calls, _, _ = self.run_task('claude', 'session', claude='quota', codex='quota')
        self.assertEqual((code, calls), (1, 'claude\ncodex\n'))

    def test_unrelated_error_does_not_switch(self):
        code, calls, _, _ = self.run_task('codex', 'session', codex='error')
        self.assertEqual((code, calls), (2, 'codex\n'))

    def test_missing_fallback_credentials(self):
        code, calls, _, _ = self.run_task('claude', 'session', claude='quota', missing='codex')
        self.assertEqual((code, calls), (1, 'claude\n'))

    def test_evaluate_quota_skips_without_error_or_fallback(self):
        for agent in ['claude', 'codex']:
            code, calls, output, feedback = self.run_task(agent, 'evaluate', claude='quota', codex='quota')
            self.assertEqual((code, calls, feedback), (0, agent+'\n', False))
            self.assertNotIn('completed=true', output)

    def test_evaluate_success(self):
        code, calls, output, feedback = self.run_task('codex', 'evaluate')
        self.assertEqual((code, calls, feedback), (0, 'codex\n', True))
        self.assertIn('completed=true', output)

    def test_generic_limit_text_is_not_quota(self):
        self.assertIsNone(runner.QUOTA.search('Added a limit check to the UI'))


if __name__ == '__main__':
    unittest.main()
