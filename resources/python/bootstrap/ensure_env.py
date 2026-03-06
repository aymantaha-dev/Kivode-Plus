#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str], cwd: str | None = None) -> None:
    completed = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if completed.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime-python', required=True)
    parser.add_argument('--venv-root', required=True)
    parser.add_argument('--requirements', required=True)
    parser.add_argument('--wheels-dir', required=True)
    return parser.parse_args()


def resolve_venv_python(venv_root: Path) -> Path:
    if sys.platform == 'win32':
        return venv_root / 'Scripts' / 'python.exe'
    return venv_root / 'bin' / 'python3'


def main() -> int:
    args = parse_args()
    runtime_python = Path(args.runtime_python).resolve()
    venv_root = Path(args.venv_root).resolve()
    requirements = Path(args.requirements).resolve()
    wheels_dir = Path(args.wheels_dir).resolve()

    if not runtime_python.exists():
        raise RuntimeError(f"Bundled runtime python missing: {runtime_python}")
    if not requirements.exists():
        raise RuntimeError(f"requirements file missing: {requirements}")
    if not wheels_dir.exists():
        raise RuntimeError(f"wheels directory missing: {wheels_dir}")

    venv_python = resolve_venv_python(venv_root)
    if not venv_python.exists():
        venv_root.parent.mkdir(parents=True, exist_ok=True)
        run([str(runtime_python), '-m', 'venv', str(venv_root)])

    run([str(venv_python), '-m', 'ensurepip', '--upgrade'])
    run([
        str(venv_python),
        '-m',
        'pip',
        'install',
        '--no-index',
        '--find-links',
        str(wheels_dir),
        '-r',
        str(requirements),
    ])

    print(f"Sandbox environment ready at {venv_root}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
