#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import traceback
from contextlib import redirect_stderr, redirect_stdout

from sandbox_policy import ALLOWED_IMPORTS, BLOCKED_IMPORTS, WorkspaceAccessError, apply_sandbox_policy
from sandbox_tasks import TaskContext, execute_task

MAX_OUTPUT_BYTES = 200 * 1024


def _limit_resources(memory_mb: int):
    try:
        import resource  # type: ignore

        limit_bytes = memory_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (limit_bytes, limit_bytes))
    except Exception:
        return


def _truncate(value: str) -> str:
    encoded = value.encode("utf-8", errors="replace")
    if len(encoded) <= MAX_OUTPUT_BYTES:
        return value
    return encoded[:MAX_OUTPUT_BYTES].decode("utf-8", errors="ignore") + "\n...[truncated]"


def _load_payload(args: argparse.Namespace):
    if args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as fh:
            return json.load(fh)

    if args.input_stdin:
        raw = sys.stdin.read()
        return json.loads(raw)

    if args.input:
        return json.loads(args.input)

    raise ValueError("No input provided. Use --input-file, --input-stdin, or --input.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--sandbox-root", required=True)
    parser.add_argument("--input", required=False)
    parser.add_argument("--input-file", dest="input_file")
    parser.add_argument("--input-stdin", action="store_true")
    parser.add_argument("--memory-mb", type=int, default=256)
    args = parser.parse_args()

    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()

    _limit_resources(args.memory_mb)

    try:
        payload = _load_payload(args)
    except Exception as exc:
        print(json.dumps({"ok": False, "summary": "Invalid task payload", "stderr": str(exc)}))
        return 1

    try:
        access = apply_sandbox_policy(args.workspace, args.sandbox_root)
        context = TaskContext(workspace_root=args.workspace, sandbox_root=args.sandbox_root, access=access)

        with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
            result = execute_task(args.task, payload, context)

        response = {
            "ok": True,
            "summary": result.get("summary", "Sandbox task completed"),
            "data": result,
            "stdout": _truncate(stdout_buffer.getvalue()),
            "stderr": _truncate(stderr_buffer.getvalue()),
            "security": {
                "network": "disabled_mvp",
                "blockedImports": sorted(BLOCKED_IMPORTS),
                "allowlistCount": len(ALLOWED_IMPORTS),
                "hardSandboxTodo": "Use OS-level sandboxing (Job Objects / sandbox-exec / bubblewrap).",
            },
        }
        print(json.dumps(response, ensure_ascii=False))
        return 0
    except WorkspaceAccessError as exc:
        print(json.dumps({"ok": False, "summary": "Filesystem restriction", "stderr": str(exc)}))
        return 1
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "summary": "Sandbox task failed",
            "stderr": _truncate(f"{exc}\n{traceback.format_exc()}"),
            "stdout": _truncate(stdout_buffer.getvalue()),
        }))
        return 1


if __name__ == "__main__":
    sys.exit(main())
