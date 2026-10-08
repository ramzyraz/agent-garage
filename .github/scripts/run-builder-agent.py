#!/usr/bin/env python3
"""Run a Builder task, retrying once with the other provider on quota errors."""
import argparse
import os
from pathlib import Path
import re
import subprocess
import sys

# Match provider diagnostics, not generic mentions of limits in generated prose.
QUOTA = re.compile(
    r"you(?:'|’)?ve (?:hit|reached) (?:your |the )?(?:individual spend|usage|weekly|daily|rate) limit"
    r"|you have (?:hit|reached) (?:your |the )?(?:usage|weekly|daily|rate) limit"
    r"|(?:error|failed|exceeded|reached)[^\n]{0,100}(?:usage_limit_reached|rate_limit_exceeded|insufficient_quota)"
    r"|\b(?:usage_limit_reached|rate_limit_exceeded|insufficient_quota)\b"
    r"|(?:usage|spend|weekly|daily) limit (?:has been )?(?:reached|exceeded)"
    r"|rate limit (?:reached|exceeded)"
    r"|credit balance is too low"
    r"|you exceeded your current quota", re.I,
)


def available(agent):
    return bool(os.environ.get('CLAUDE_CODE_OAUTH_TOKEN' if agent == 'claude' else 'CODEX_AUTH_JSON'))


def command(agent, task, session, continuation=False):
    if task == 'session':
        prompt = f'You are {"Claude Code" if agent == "claude" else "OpenAI Codex"}. Read projects/builder/AGENT.md and follow it. Run this session.'
        if continuation:
            prompt += ' The previous provider hit its usage limit during this same session. Inspect existing working-tree changes and logs, preserve its work, and finish this session rather than starting another session.'
    else:
        prompt = f'You are {"Claude Code" if agent == "claude" else "OpenAI Codex"}, the evaluator. Read EVALUATOR.md and follow it. This is the review after session {session}.'
    if agent == 'claude':
        return ['claude', '-p', prompt, '--model', 'opus' if task == 'session' else 'sonnet', '--max-turns', '80' if task == 'session' else '30', '--dangerously-skip-permissions']
    return ['codex', 'exec', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort=' + ('high' if task == 'session' else 'medium'), prompt]


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--agent', choices=['claude', 'codex'], required=True)
    p.add_argument('--task', choices=['session', 'evaluate'], required=True)
    p.add_argument('--session', default='')
    args = p.parse_args()
    agents = [args.agent]
    if args.task == 'session':
        agents.append('codex' if args.agent == 'claude' else 'claude')
    for attempt, agent in enumerate(agents):
        if not available(agent):
            print(f'::warning::{agent} credentials unavailable.', flush=True)
            continue
        package = '@anthropic-ai/claude-code' if agent == 'claude' else '@openai/codex'
        subprocess.run(['npm', 'install', '-g', package], check=True)
        if agent == 'codex':
            auth = Path.home() / '.codex' / 'auth.json'
            if not auth.exists():
                auth.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                auth.write_text(os.environ['CODEX_AUTH_JSON'])
                auth.chmod(0o600)
                import hashlib
                Path('/tmp/auth.sha').write_text(hashlib.sha256(auth.read_bytes()).hexdigest() + '\n')
        with open(os.environ['GITHUB_OUTPUT'], 'a') as out:
            out.write(f'agent={agent}\n')
        # Do not expose either provider's credentials to the other agent process.
        env = dict(os.environ)
        env.pop('CODEX_AUTH_JSON', None)
        if agent != 'claude':
            env.pop('CLAUDE_CODE_OAUTH_TOKEN', None)
        proc = subprocess.Popen(command(agent, args.task, args.session, attempt > 0), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
        quota = False
        for line in proc.stdout:
            print(line, end='', flush=True)
            quota = quota or bool(QUOTA.search(line))
        status = proc.wait()
        # Claude can report a quota limit while exiting successfully.
        if quota:
            if args.task == 'evaluate':
                # A partial review is not a completed evaluation.
                Path('feedback.md').unlink(missing_ok=True)
                print(f'::warning::{agent} usage limit reached; skipping evaluation.', flush=True)
                return 0
            print(f'::warning::{agent} reported a usage limit; trying the other provider if available.', flush=True)
            continue
        if status == 0:
            with open(os.environ['GITHUB_OUTPUT'], 'a') as out:
                out.write('completed=true\n')
        return status
    print('::error::No provider could complete the task: usage limit or missing credentials.', flush=True)
    return 1


if __name__ == '__main__':
    sys.exit(main())
