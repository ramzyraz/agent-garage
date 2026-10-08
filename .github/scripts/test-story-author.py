import os
from pathlib import Path
import subprocess
import tempfile
import unittest

RUNNER = Path(__file__).with_name('run-story-author.py').resolve()


class AuthorTests(unittest.TestCase):
    def test_private_diagnostics_and_rollback(self):
        for message, status, expected in [("You've hit your individual spend limit", 1, 75), ("You've hit your usage limit", 0, 75), ('PRIVATE PLOT TEXT', 1, 1), ('PRIVATE PLOT TEXT', 0, 0), ("You've hit your usage limit", 1, 0)]:
            with self.subTest(message=message, status=status), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                for folder in ['projects/story', 'site/story']:
                    (root/folder).mkdir(parents=True)
                    (root/folder/'existing').write_text('original')
                fake = root/'claude'
                fake.write_text('#!/bin/sh\nprintf "%s\\n" "$MOCK_TEXT"\nprintf partial > site/story/existing\nprintf partial > projects/story/draft\nexit "$MOCK_STATUS"\n')
                fake.chmod(0o755)
                codex = root/'codex'
                codex.write_text('#!/bin/sh\necho ERROR: usage_limit_reached\nexit 1\n')
                codex.chmod(0o755)
                if message == "You've hit your usage limit" and status == 1:
                    codex.write_text('#!/bin/sh\nprintf partial > site/story/existing\nprintf partial > projects/story/draft\n')
                result = subprocess.run(['python3', str(RUNNER)], cwd=root, env={**os.environ, 'PATH': directory+':'+os.environ['PATH'], 'MOCK_TEXT': message, 'MOCK_STATUS': str(status)}, capture_output=True, text=True)
                self.assertEqual(result.returncode, expected)
                self.assertNotIn('PRIVATE PLOT TEXT', result.stdout+result.stderr)
                self.assertEqual((root/'site/story/existing').read_text(), 'original' if expected else 'partial')
                self.assertEqual((root/'projects/story/draft').exists(), expected == 0)


if __name__ == '__main__':
    unittest.main()
