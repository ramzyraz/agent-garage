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


def run_author(agent):
    with tempfile.TemporaryDirectory() as backup, tempfile.TemporaryFile(mode='w+t') as output:
        # Discard incomplete author changes, preserving earlier completed chapters.
        paths = [Path('projects/story'), Path('site/story')]
        for index, path in enumerate(paths):
            if path.exists():
                shutil.copytree(path, Path(backup) / str(index))
        if agent == 'claude':
            command = ['claude', '-p', 'You are the AUTHOR (Claude Code). Read projects/story/STORY.md and follow it. Write the next chapter.', '--model', 'sonnet', '--max-turns', '40', '--dangerously-skip-permissions']
        else:
            command = ['codex', 'exec', '--dangerously-bypass-approvals-and-sandbox', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort=high', 'You are the AUTHOR (OpenAI Codex), temporarily replacing Claude Code because its usage limit was reached. Read projects/story/STORY.md and follow the Author instructions, regardless of the provider named in the role heading. Write exactly the next chapter. Do not act as editor in this invocation.']
        result = subprocess.run(command, stdout=output, stderr=subprocess.STDOUT)
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
        print(f'::warning::{agent} author usage limit reached (story output hidden).')
        return 75
    if result.returncode:
        print(f'::error::{agent} author failed for a non-quota reason (story output hidden).')
        return 1
    return 0


def main():
    status = run_author('claude')
    if status == 75:
        print('Claude quota exhausted; trying Codex as author.')
        status = run_author('codex')
    return status


if __name__ == '__main__':
    sys.exit(main())
