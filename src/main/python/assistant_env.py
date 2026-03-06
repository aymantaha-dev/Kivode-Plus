#!/usr/bin/env python3
import argparse
import ast
import difflib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

MAX_FILE_SIZE = 300_000
IGNORE_DIRS = {'.git', 'node_modules', 'dist', 'build', '.next', '.idea', '.vscode', '__pycache__'}
TEXT_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.css', '.scss', '.html', '.yml', '.yaml', '.toml', '.rs', '.go', '.java', '.sh'
}

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def ok(data: Dict[str, Any]):
    return {"ok": True, **data}


def fail(message: str):
    return {"ok": False, "error": message}


def is_text_file(path: Path) -> bool:
    plain_text_names = {
        'dockerfile', 'makefile', 'license', 'licence', 'copying', 'readme', 'changelog', 'authors', '.env.example'
    }
    return path.suffix.lower() in TEXT_EXTENSIONS or path.name.lower() in plain_text_names


def ensure_in_root(root: Path, target: Path) -> None:
    root_r = root.resolve()
    target_r = target.resolve()
    if root_r == target_r:
        return
    if root_r not in target_r.parents:
        raise ValueError('Path escape detected: writing outside project root is forbidden')


def rel_path(root: Path, path: Path) -> str:
    return str(path.resolve().relative_to(root.resolve())).replace('\\', '/')


def iter_files(root: Path):
    for current_root, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            p = Path(current_root) / f
            try:
                if p.stat().st_size > MAX_FILE_SIZE:
                    continue
            except OSError:
                continue
            if is_text_file(p):
                yield p


def extract_python_symbols(text: str) -> Dict[str, Any]:
    result = {"functions": [], "classes": [], "imports": []}
    try:
        tree = ast.parse(text)
    except Exception:
        return result

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            result["functions"].append({"name": node.name, "line_start": node.lineno, "line_end": getattr(node, 'end_lineno', node.lineno)})
        elif isinstance(node, ast.ClassDef):
            result["classes"].append({"name": node.name, "line_start": node.lineno, "line_end": getattr(node, 'end_lineno', node.lineno)})
        elif isinstance(node, ast.Import):
            for alias in node.names:
                result["imports"].append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ''
            for alias in node.names:
                result["imports"].append(f"{mod}.{alias.name}" if mod else alias.name)
    return result


def extract_generic_symbols(text: str, suffix: str) -> Dict[str, Any]:
    result = {"functions": [], "classes": [], "imports": []}
    lines = text.splitlines()

    if suffix in {'.ts', '.tsx', '.js', '.jsx'}:
        for i, line in enumerate(lines, start=1):
            fn_match = re.search(r'\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\b', line)
            if not fn_match:
                fn_match = re.search(r'\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?\(', line)
            if fn_match:
                result["functions"].append({"name": fn_match.group(1), "line_start": i, "line_end": i})

            class_match = re.search(r'\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b', line)
            if class_match:
                result["classes"].append({"name": class_match.group(1), "line_start": i, "line_end": i})

            import_match = re.search(r'^\s*import\s+.*\s+from\s+[\"\']([^\"\']+)[\"\']', line)
            if import_match:
                result["imports"].append(import_match.group(1))

    elif suffix in {'.md'}:
        for i, line in enumerate(lines, start=1):
            heading = re.match(r'^\s{0,3}#{1,6}\s+(.+)$', line)
            if heading:
                result["classes"].append({"name": heading.group(1).strip(), "line_start": i, "line_end": i})

    return result


def index_project(root: Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for path in iter_files(root):
        try:
            content = path.read_text(encoding='utf-8', errors='ignore')
        except OSError:
            continue
        entry = {"path": rel_path(root, path), "symbols": {"functions": [], "classes": [], "imports": []}}
        if path.suffix.lower() == '.py':
            entry["symbols"] = extract_python_symbols(content)
        else:
            entry["symbols"] = extract_generic_symbols(content, path.suffix.lower())
        out.append(entry)
    out.sort(key=lambda item: item.get("path", ""))
    return out


def _tokenize_query(query: str) -> List[str]:
    normalized = re.sub(r'[^\w\u0600-\u06FF]+', ' ', query.lower()).strip()
    stop_words = {
        'the', 'a', 'an', 'to', 'in', 'on', 'for', 'and', 'or', 'of', 'is', 'are', 'please', 'file', 'page',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    }
    return [t for t in normalized.split() if len(t) > 1 and t not in stop_words]


def _score_path(path_text: str, tokens: List[str]) -> int:
    p = path_text.lower()
    return sum(3 for t in tokens if t in p)


def _intent_path_bias(query: str, path_text: str) -> int:
    q = query.lower()
    p = path_text.lower()
    bias = 0

    seo_a11y_request = any(term in q for term in [
        'seo', 'accessibility', 'a11y', 'meta', 'aria', 'semantic', 'schema',
        '', ' ', ' ', ''
    ])
    translation_request = any(term in q for term in [
        'translation', 'locale', 'i18n', 'l10n', 'language file',
        '', '', '', 'localization'
    ])

    is_locale_file = bool(re.search(r'(^|/)(language|lang|locales|i18n)(/|$)', p)) or bool(re.search(r'(^|/)ar\.(js|json|ts)$', p))
    is_html_like = p.endswith('.html') or p.endswith('.htm') or p.endswith('.tsx') or p.endswith('.jsx')
    is_entry_page = bool(re.search(r'(^|/)(index|home|main|app|page)\.(html|tsx|jsx)$', p))

    if seo_a11y_request:
      if is_entry_page:
          bias += 10
      elif is_html_like:
          bias += 6
      if is_locale_file:
          bias -= 10

    if translation_request:
      if is_locale_file:
          bias += 8
      elif is_html_like:
          bias -= 2

    return bias


def search_project(root: Path, query: str, mode: str = 'keyword', limit: int = 10) -> List[Dict[str, Any]]:
    q = query.strip()
    if not q:
        return []

    tokens = _tokenize_query(q)
    results = []
    rgx = None
    if mode == 'regex':
        rgx = re.compile(q, flags=re.IGNORECASE)

    for path in iter_files(root):
        try:
            content = path.read_text(encoding='utf-8', errors='ignore')
        except OSError:
            continue

        path_rel = rel_path(root, path)
        lines = content.splitlines()
        matches: List[Tuple[int, str]] = []
        lexical_score = _score_path(path_rel, tokens)

        for i, line in enumerate(lines, start=1):
            matched = False
            if mode == 'function_name':
                matched = re.search(rf'\b(def|function)\s+{re.escape(q)}\b', line, flags=re.IGNORECASE) is not None
            elif mode == 'regex' and rgx:
                matched = rgx.search(line) is not None
            else:
                hay = line.lower()
                if tokens:
                    matched = any(t in hay for t in tokens)
                else:
                    matched = q.lower() in hay

            if matched:
                snippet = line[:300]
                matches.append((i, snippet))
                hay = snippet.lower()
                lexical_score += 1 + sum(1 for t in tokens if t in hay)
            if len(matches) >= 4:
                break

        if not matches:
            continue

        symbol_bonus = 0
        if path.suffix.lower() == '.py':
            symbols = extract_python_symbols(content)
        else:
            symbols = extract_generic_symbols(content, path.suffix.lower())

        symbol_names = [s.get('name', '').lower() for s in symbols.get('functions', []) + symbols.get('classes', [])]
        if tokens and symbol_names:
            symbol_bonus = sum(2 for t in tokens if any(t in name for name in symbol_names))

        intent_bias = _intent_path_bias(q, path_rel)
        score = max(1, lexical_score + symbol_bonus + intent_bias)
        results.append({
            "path": path_rel,
            "score": score,
            "matches": [{"line": ln, "text": tx} for ln, tx in matches],
            "symbol_hits": symbol_bonus,
            "intent_bias": intent_bias,
        })

    results.sort(key=lambda item: item.get('score', 0), reverse=True)
    return results[:max(1, limit)]


def unified_diff(old: str, new: str, file_path: str) -> str:
    return ''.join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), fromfile=f'a/{file_path}', tofile=f'b/{file_path}'))


def replace_python_function_body(file_content: str, function_name: str, new_body: str) -> str:
    lines = file_content.splitlines()
    tree = ast.parse(file_content)
    target = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
            target = node
            break
    if target is None:
        raise ValueError(f'Function not found: {function_name}')

    if not target.body:
        raise ValueError('Target function has empty body')

    start = target.body[0].lineno
    end = getattr(target.body[-1], 'end_lineno', target.body[-1].lineno)
    indent_match = re.match(r'^(\s*)', lines[start - 1] if start - 1 < len(lines) else '    ')
    indent = indent_match.group(1) if indent_match else '    '

    new_body_lines = [indent + b if b.strip() else '' for b in new_body.splitlines()]
    if not new_body_lines:
        new_body_lines = [indent + 'pass']

    updated = lines[:start - 1] + new_body_lines + lines[end:]
    return '\n'.join(updated) + ('\n' if file_content.endswith('\n') else '')


def create_file(root: Path, relative: str, content: str) -> Dict[str, Any]:
    safe = relative.replace('\\', '/').strip().lstrip('./')
    if not safe or '..' in safe.split('/'):
        raise ValueError('Unsafe file path')
    target = (root / safe)
    ensure_in_root(root, target)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')
    return {"path": safe, "size": len(content)}


def run_validations(root: Path) -> Dict[str, Any]:
    # restricted, no system command execution by default.
    return {
        "linter": {"status": "skipped", "reason": "Restricted mode"},
        "formatter": {"status": "skipped", "reason": "Restricted mode"},
        "tests": {"status": "skipped", "reason": "Restricted mode"},
    }


def strip_patch_fences(patch_text: str) -> str:
    cleaned = patch_text.strip()
    if cleaned.startswith('```'):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        cleaned = '\n'.join(lines)
    return cleaned


def _find_subsequence(lines: List[str], pattern: List[str], start: int = 0, normalize_ws: bool = False) -> int:
    if not pattern:
        return start

    def norm(v: str) -> str:
        if not normalize_ws:
            return v
        return ' '.join(v.strip().split())

    limit = len(lines) - len(pattern) + 1
    for i in range(max(0, start), max(0, limit)):
        ok_match = True
        for j, p in enumerate(pattern):
            if norm(lines[i + j]) != norm(p):
                ok_match = False
                break
        if ok_match:
            return i
    return -1


def _find_anchor_based_position(lines: List[str], pattern: List[str]) -> int:
    if not pattern:
        return -1

    normalized_pattern = [' '.join(item.strip().split()) for item in pattern]
    anchored_entries = [(idx, value) for idx, value in enumerate(normalized_pattern) if value]
    if not anchored_entries:
        return -1

    best_position = -1
    best_score = -1
    first_anchor_index, first_anchor_value = anchored_entries[0]

    for line_idx, current in enumerate(lines):
        if ' '.join(current.strip().split()) != first_anchor_value:
            continue

        candidate_start = line_idx - first_anchor_index
        if candidate_start < 0:
            continue

        end = candidate_start + len(pattern)
        if end > len(lines):
            continue

        score = 0
        for offset, expected in enumerate(normalized_pattern):
            if not expected:
                continue
            actual = ' '.join(lines[candidate_start + offset].strip().split())
            if actual == expected:
                score += 1

        if score > best_score:
            best_score = score
            best_position = candidate_start

    minimum_score = max(1, len(anchored_entries) // 2)
    if best_position >= 0 and best_score >= minimum_score:
        return best_position
    return -1



def apply_unified_patch(original: str, patch_text: str) -> str:
    src = original.splitlines()
    out: List[str] = []
    i = 0

    lines = patch_text.splitlines()
    idx = 0
    while idx < len(lines) and not lines[idx].startswith('@@'):
        idx += 1

    while idx < len(lines):
        header = lines[idx]
        if not header.startswith('@@'):
            idx += 1
            continue

        m = re.match(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", header)
        if not m:
            raise ValueError('Invalid patch hunk header')

        old_start = int(m.group(1)) - 1

        # copy untouched block before hunk
        while i < old_start and i < len(src):
            out.append(src[i])
            i += 1

        idx += 1
        while idx < len(lines) and not lines[idx].startswith('@@'):
            line = lines[idx]
            if not line:
                tag = ' '
                content = ''
            else:
                tag = line[0]
                content = line[1:] if len(line) > 1 else ''

            if tag == ' ':
                if i >= len(src) or src[i] != content:
                    raise ValueError('Patch context mismatch')
                out.append(src[i])
                i += 1
            elif tag == '-':
                if i >= len(src) or src[i] != content:
                    raise ValueError('Patch removal mismatch')
                i += 1
            elif tag == '+':
                out.append(content)
            elif tag == '\\':
                # "\ No newline at end of file"
                pass
            else:
                raise ValueError(f'Unsupported patch line: {line[:20]}')
            idx += 1

    while i < len(src):
        out.append(src[i])
        i += 1

    return '\n'.join(out) + ('\n' if original.endswith('\n') else '')


def apply_unified_patch_fallback(original: str, patch_text: str) -> str:
    out = original.splitlines()
    lines = patch_text.splitlines()
    idx = 0
    cursor = 0

    while idx < len(lines):
        if not lines[idx].startswith('@@'):
            idx += 1
            continue

        idx += 1
        hunk_body: List[str] = []
        while idx < len(lines) and not lines[idx].startswith('@@'):
            hunk_body.append(lines[idx])
            idx += 1

        old_block: List[str] = []
        new_block: List[str] = []
        for line in hunk_body:
            if not line:
                tag = ' '
                content = ''
            else:
                tag = line[0]
                content = line[1:] if len(line) > 1 else ''

            if tag == ' ':
                old_block.append(content)
                new_block.append(content)
            elif tag == '-':
                old_block.append(content)
            elif tag == '+':
                new_block.append(content)
            elif tag == '\\':
                continue
            else:
                raise ValueError(f'Unsupported patch line: {line[:20]}')

        if not old_block and new_block:
            insert_at = min(cursor, len(out))
            out[insert_at:insert_at] = new_block
            cursor = insert_at + len(new_block)
            continue

        pos = _find_subsequence(out, old_block, start=cursor, normalize_ws=False)
        if pos < 0:
            pos = _find_subsequence(out, old_block, start=0, normalize_ws=False)
        if pos < 0:
            pos = _find_subsequence(out, old_block, start=cursor, normalize_ws=True)
        if pos < 0:
            pos = _find_subsequence(out, old_block, start=0, normalize_ws=True)
        if pos < 0:
            pos = _find_anchor_based_position(out, old_block)

        if pos < 0:
            raise ValueError('Patch fallback failed to locate target block')

        out[pos:pos + len(old_block)] = new_block
        cursor = pos + len(new_block)

    return '\n'.join(out) + ('\n' if original.endswith('\n') else '')


def apply_patch_action(root: Path, command: Dict[str, Any]) -> Dict[str, Any]:
    file_rel = command.get('file')
    patch_text = command.get('patch', '')
    if not file_rel or not isinstance(patch_text, str) or not patch_text.strip():
        return fail('file and patch are required')

    file_path = (root / file_rel)
    ensure_in_root(root, file_path)
    if not file_path.exists():
        return fail('Target file does not exist')

    old = file_path.read_text(encoding='utf-8', errors='ignore')
    cleaned_patch = strip_patch_fences(patch_text)

    try:
        new = apply_unified_patch(old, cleaned_patch)
        strategy = 'strict'
    except ValueError as strict_error:
        if 'Patch removal mismatch' not in str(strict_error) and 'Patch context mismatch' not in str(strict_error):
            return fail(str(strict_error))
        try:
            new = apply_unified_patch_fallback(old, cleaned_patch)
            strategy = 'fallback'
        except ValueError as fallback_error:
            return fail(str(fallback_error))

    return ok({
        "file": file_rel,
        "before": old,
        "after": new,
        "diff": unified_diff(old, new, file_rel),
        "patchStrategy": strategy,
    })

def handle(root: Path, command: Dict[str, Any]) -> Dict[str, Any]:
    action = command.get('action')
    if action == 'summarize_attachment':
        name = str(command.get('name', 'attachment')).strip() or 'attachment'
        encoding = str(command.get('encoding', 'utf-8')).lower()
        raw_content = command.get('content', '')
        if not isinstance(raw_content, str) or raw_content == '':
            return fail('Attachment content is required')

        if encoding == 'base64':
            try:
                import base64
                decoded = base64.b64decode(raw_content, validate=False)
                content = decoded.decode('utf-8', errors='ignore')
            except Exception:
                return fail('Failed to decode base64 attachment content')
        else:
            content = raw_content

        lines = content.splitlines()
        snippet = '\n'.join(lines[:80])
        suffix = Path(name).suffix.lower()
        symbols = extract_python_symbols(content) if suffix == '.py' else extract_generic_symbols(content, suffix)

        return ok({
            'name': name,
            'encoding': encoding,
            'summary': {
                'chars': len(content),
                'lines': len(lines),
                'functions': len(symbols.get('functions', [])),
                'classes': len(symbols.get('classes', [])),
                'imports': len(symbols.get('imports', [])),
                'preview': snippet,
            }
        })
    if action == 'load_attachment':
        name = str(command.get('name', 'attachment')).strip() or 'attachment'
        encoding = str(command.get('encoding', 'utf-8')).lower()
        raw_content = command.get('content', '')
        if not isinstance(raw_content, str) or raw_content == '':
            return fail('Attachment content is required')

        if encoding == 'base64':
            try:
                import base64
                decoded = base64.b64decode(raw_content, validate=False)
                content = decoded.decode('utf-8', errors='ignore')
            except Exception:
                return fail('Failed to decode base64 attachment content')
        else:
            content = raw_content

        return ok({
            'name': name,
            'content': content,
            'encoding': 'utf-8',
            'chars': len(content),
            'lines': len(content.splitlines()),
        })
    if action == 'analyze_project':
        return ok({"index": index_project(root)})
    if action == 'smart_search':
        return ok({"results": search_project(root, command.get('query', ''), command.get('mode', 'keyword'), int(command.get('limit', 10)))})
    if action == 'replace_body':
        file_rel = command.get('file')
        target_name = command.get('target_name')
        new_body = command.get('new_body', '')
        if not file_rel or not target_name:
            return fail('file and target_name are required')
        file_path = (root / file_rel)
        ensure_in_root(root, file_path)
        old = file_path.read_text(encoding='utf-8', errors='ignore')
        new = replace_python_function_body(old, target_name, new_body)
        return ok({"file": file_rel, "before": old, "after": new, "diff": unified_diff(old, new, file_rel)})
    if action == 'apply_patch':
        return apply_patch_action(root, command)
    if action == 'open_file':
        rel = str(command.get('path', '')).replace('\\', '/').strip().lstrip('./')
        if not rel or '..' in rel.split('/'):
            return fail('Unsafe file path')
        file_path = (root / rel)
        ensure_in_root(root, file_path)
        if not file_path.exists():
            return fail('Target file does not exist')
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        return ok({"path": rel, "content": content})
    if action == 'create_file':
        info = create_file(root, command.get('path', ''), command.get('content', ''))
        return ok({"created": info})
    if action == 'validate':
        return ok({"validation": run_validations(root)})
    return fail(f'Unknown action: {action}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True)
    parser.add_argument('--payload', required=True)
    args = parser.parse_args()

    root = Path(args.project).resolve()
    if not root.exists() or not root.is_dir():
        print(json.dumps(fail('Invalid project path'), ensure_ascii=True))
        return

    try:
        payload = json.loads(args.payload)
    except json.JSONDecodeError:
        print(json.dumps(fail('Invalid JSON payload'), ensure_ascii=True))
        return

    try:
        response = handle(root, payload)
    except Exception as e:
        response = fail(str(e))
    print(json.dumps(response, ensure_ascii=True))


if __name__ == '__main__':
    main()
