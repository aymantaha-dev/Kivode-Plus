from __future__ import annotations

from pathlib import Path


class WorkspaceAccessError(Exception):
    pass


class WorkspaceAccess:
    def __init__(self, workspace_root: str, sandbox_root: str):
        self.workspace_root = Path(workspace_root).resolve()
        self.sandbox_root = Path(sandbox_root).resolve()
        self.sandbox_root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, target: str) -> Path:
        return Path(target).expanduser().resolve()

    def _is_within(self, root: Path, target: Path) -> bool:
        return target == root or root in target.parents

    def ensure_workspace_read(self, target: str) -> Path:
        resolved = self._resolve(target)
        if not self._is_within(self.workspace_root, resolved):
            raise WorkspaceAccessError(f"Read denied outside workspace: {resolved}")
        return resolved

    def ensure_sandbox_write(self, target: str) -> Path:
        resolved = self._resolve(target)
        if not self._is_within(self.sandbox_root, resolved):
            raise WorkspaceAccessError(f"Write denied outside sandbox root: {resolved}")
        resolved.parent.mkdir(parents=True, exist_ok=True)
        return resolved

    def read_text(self, target: str, encoding: str = "utf-8") -> str:
        safe_path = self.ensure_workspace_read(target)
        return safe_path.read_text(encoding=encoding, errors="replace")

    def write_text(self, target: str, content: str, encoding: str = "utf-8") -> str:
        safe_path = self.ensure_sandbox_write(target)
        safe_path.write_text(content, encoding=encoding)
        return str(safe_path)
