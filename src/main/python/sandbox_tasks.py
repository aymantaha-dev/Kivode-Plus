from __future__ import annotations

import ast
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

try:
    import tomllib  # py311+
except Exception:  # pragma: no cover
    tomllib = None

import yaml
from bs4 import BeautifulSoup

from workspace_access import WorkspaceAccess


@dataclass
class TaskContext:
    workspace_root: str
    sandbox_root: str
    access: WorkspaceAccess


def regex_test(payload: Dict[str, Any], _ctx: TaskContext) -> Dict[str, Any]:
    pattern = payload.get("pattern", "")
    flags = re.IGNORECASE if payload.get("ignoreCase") else 0
    rgx = re.compile(pattern, flags=flags)
    samples = payload.get("samples", [])
    results = []
    for text in samples:
        matches = [m.group(0) for m in rgx.finditer(str(text))]
        results.append({"text": text, "matches": matches})
    return {"summary": f"Regex evaluated on {len(samples)} sample(s)", "data": results}


def json_validate(payload: Dict[str, Any], _ctx: TaskContext) -> Dict[str, Any]:
    raw = payload.get("content", "")
    try:
        json.loads(raw)
        return {"summary": "JSON is valid", "valid": True}
    except json.JSONDecodeError as exc:
        return {"summary": "JSON is invalid", "valid": False, "error": str(exc)}


def yaml_validate(payload: Dict[str, Any], _ctx: TaskContext) -> Dict[str, Any]:
    raw = payload.get("content", "")
    try:
        yaml.safe_load(raw)
        return {"summary": "YAML is valid", "valid": True}
    except yaml.YAMLError as exc:
        return {"summary": "YAML is invalid", "valid": False, "error": str(exc)}


def toml_validate(payload: Dict[str, Any], _ctx: TaskContext) -> Dict[str, Any]:
    if tomllib is None:
        return {"summary": "TOML validation unavailable", "valid": False, "error": "Python tomllib not available"}
    raw = payload.get("content", "")
    try:
        tomllib.loads(raw)
        return {"summary": "TOML is valid", "valid": True}
    except Exception as exc:
        return {"summary": "TOML is invalid", "valid": False, "error": str(exc)}


def html_seo_audit(payload: Dict[str, Any], ctx: TaskContext) -> Dict[str, Any]:
    relative_path = payload.get("path")
    html_content = payload.get("content")
    if relative_path:
        safe = str((Path(ctx.workspace_root) / relative_path).resolve())
        html_content = ctx.access.read_text(safe)
    if not isinstance(html_content, str):
        raise ValueError("Missing HTML content")

    soup = BeautifulSoup(html_content, "html.parser")
    issues: List[Dict[str, Any]] = []

    if not soup.title or not soup.title.text.strip():
        issues.append({"code": "missing_title", "message": "Missing <title> tag"})

    meta_desc = soup.find("meta", attrs={"name": "description"})
    if not meta_desc or not meta_desc.get("content"):
        issues.append({"code": "missing_meta_description", "message": "Missing meta description"})

    canonical = soup.find("link", attrs={"rel": "canonical"})
    if not canonical:
        issues.append({"code": "missing_canonical", "message": "Missing canonical link"})

    h1s = soup.find_all("h1")
    if len(h1s) != 1:
        issues.append({"code": "h1_count", "message": f"Expected exactly one H1, found {len(h1s)}"})

    for image in soup.find_all("img"):
        if not image.get("alt"):
            issues.append({"code": "img_alt", "message": "Image missing alt attribute"})
            break

    html_tag = soup.find("html")
    if html_tag and not html_tag.get("lang"):
        issues.append({"code": "missing_lang", "message": "HTML lang attribute is missing"})

    return {
        "summary": f"SEO audit finished with {len(issues)} issue(s)",
        "issues": issues,
    }


def python_ast_check(payload: Dict[str, Any], ctx: TaskContext) -> Dict[str, Any]:
    relative_path = payload.get("path")
    if not relative_path:
        raise ValueError("Missing Python file path")
    full_path = str((Path(ctx.workspace_root) / relative_path).resolve())
    content = ctx.access.read_text(full_path)
    tree = ast.parse(content)
    imports, functions, classes = [], [], []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            imports.extend(f"{mod}.{alias.name}" if mod else alias.name for alias in node.names)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append({"name": node.name, "line": node.lineno})
        elif isinstance(node, ast.ClassDef):
            classes.append({"name": node.name, "line": node.lineno})
    return {
        "summary": f"AST parsed: {len(functions)} function(s), {len(classes)} class(es)",
        "imports": imports,
        "functions": functions,
        "classes": classes,
    }


def diff_sanity(payload: Dict[str, Any], _ctx: TaskContext) -> Dict[str, Any]:
    patch = str(payload.get("patch", ""))
    removed = sum(1 for line in patch.splitlines() if line.startswith("-") and not line.startswith("---"))
    added = sum(1 for line in patch.splitlines() if line.startswith("+") and not line.startswith("+++"))
    suspicious = removed > 600 or (removed > 0 and added == 0)
    return {
        "summary": "Diff sanity check completed",
        "removedLines": removed,
        "addedLines": added,
        "suspicious": suspicious,
    }


TASK_HANDLERS = {
    "RegexTestTask": regex_test,
    "JsonValidateTask": json_validate,
    "YamlValidateTask": yaml_validate,
    "TomlValidateTask": toml_validate,
    "HtmlSeoAuditTask": html_seo_audit,
    "PythonAstCheckTask": python_ast_check,
    "DiffSanityTask": diff_sanity,
}


def execute_task(task_type: str, payload: Dict[str, Any], ctx: TaskContext) -> Dict[str, Any]:
    handler = TASK_HANDLERS.get(task_type)
    if not handler:
        raise ValueError(f"Unsupported sandbox task type: {task_type}")
    return handler(payload, ctx)
