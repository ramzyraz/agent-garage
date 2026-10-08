#!/usr/bin/env python3
"""Keep author output private while distinguishing quota failures from other errors."""
import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

spec = importlib.util.spec_from_file_location('builder_runner', Path(__file__).with_name('run-builder-agent.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def main():
    with tempfile.TemporaryDirectory() as backup, tempfile.TemporaryFile(mode='w+t') as output:
        # Discard incomplete author changes, preserving earlier completed chapters.
        paths = [Path('projects/story'), Path('site/story')]
        for index, path in enumerate(paths):
            if path.exists():
                shutil.copytree(path, Path(backup) / str(index))
        result = subprocess.run([
            'claude', '-p', 'You are the AUTHOR (Claude Code). Read projects/story/STORY.md and follow it. Write the next chapter.',
            '--model', 'sonnet', '--max-turns', '40', '--dangerously-skip-permissions',
        ], stdout=output, stderr=subprocess.STDOUT)
        output.seek(0)
        quota = any(runner.QUOTA.search(line) for line in output)
        if quota or result.returncode:
            for index, path in enumerate(paths):
                if path.exists():
                    shutil.rmtree(path)
                saved = Path(backup) / str(index)
                if saved.exists():
                    shutil.copytree(saved, path)
    if quota:
        print('::warning::Claude author usage limit reached (story output hidden).')
        return 75
    if result.returncode:
        print('::error::Claude author failed for a non-quota reason (story output hidden).')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
