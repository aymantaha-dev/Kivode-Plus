from __future__ import annotations

import builtins
import os
from pathlib import Path
from typing import Callable, Iterable

from workspace_access import WorkspaceAccess, WorkspaceAccessError

BLOCKED_IMPORTS = {
    "socket",
    "requests",
    "httpx",
    "urllib",
    "urllib3",
    "aiohttp",
    "ftplib",
    "ssl",
    "subprocess",
    "ctypes",
}

ALLOWED_IMPORTS = {
    "re", "json", "math", "statistics", "random",
    "datetime", "time", "pathlib", "fnmatch",
    "hashlib", "hmac", "base64", "typing", "dataclasses",
    "collections", "itertools", "textwrap", "difflib", "ast", "tokenize",
    "html", "html.parser", "csv", "logging", "uuid", "yaml", "toml", "tomllib",
    "bs4", "pygments", "jedi", "radon",
}


def _patch_network_guards() -> None:
    def deny(*_args, **_kwargs):
        raise PermissionError("Network is disabled in Kivode+ Python Sandbox")

    try:
        import socket as _socket  # type: ignore

        _socket.socket = deny  # type: ignore[attr-defined]
        _socket.create_connection = deny  # type: ignore[attr-defined]
    except Exception:
        pass


def _safe_open_factory(access: WorkspaceAccess):
    original_open = builtins.open

    def safe_open(file, mode="r", *args, **kwargs):
        candidate = Path(file)
        if any(flag in mode for flag in ("w", "a", "+", "x")):
            access.ensure_sandbox_write(str(candidate))
        else:
            access.ensure_workspace_read(str(candidate))
        return original_open(file, mode, *args, **kwargs)

    return safe_open


def _safe_import_factory(allowed: Iterable[str], blocked: Iterable[str], original_import: Callable):
    allowed_set = set(allowed)
    blocked_set = set(blocked)

    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        root = (name or "").split(".")[0]
        if root in blocked_set:
            raise ImportError(f"Import '{name}' is blocked in sandbox policy")
        if root not in allowed_set:
            raise ImportError(f"Import '{name}' is not allowlisted in sandbox policy")
        return original_import(name, globals, locals, fromlist, level)

    return safe_import


def apply_sandbox_policy(workspace_root: str, sandbox_root: str):
    access = WorkspaceAccess(workspace_root, sandbox_root)
    builtins.open = _safe_open_factory(access)  # type: ignore[assignment]
    builtins.__import__ = _safe_import_factory(ALLOWED_IMPORTS, BLOCKED_IMPORTS, builtins.__import__)  # type: ignore[assignment]

    # Explicitly disable process execution APIs
    os.system = lambda *_args, **_kwargs: (_ for _ in ()).throw(PermissionError("os.system is blocked"))  # type: ignore[assignment]
    os.popen = lambda *_args, **_kwargs: (_ for _ in ()).throw(PermissionError("os.popen is blocked"))  # type: ignore[assignment]

    _patch_network_guards()
    return access


__all__ = [
    "apply_sandbox_policy",
    "ALLOWED_IMPORTS",
    "BLOCKED_IMPORTS",
    "WorkspaceAccessError",
]
