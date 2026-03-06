import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@renderer/stores/useAppStore';
import { Button } from '@renderer/components/ui/button';
import { ArrowLeft, ExternalLink, Monitor, Smartphone, Tablet, RotateCw, Code2, Eye } from 'lucide-react';
import { marked } from 'marked';
import { sanitizePreviewHtml } from '@renderer/utils/security/previewSanitizer';

type DeviceType = 'desktop' | 'tablet' | 'mobile';
type Mode = 'preview' | 'source';

const deviceSizes: Record<DeviceType, { width: number; height: number }> = {
  desktop: { width: 1280, height: 820 },
  tablet: { width: 840, height: 1024 },
  mobile: { width: 412, height: 915 },
};

const normalize = (p: string) => p.replace(/\\/g, '/');
const dirOf = (p: string) => normalize(p).split('/').slice(0, -1).join('/');

export function PreviewPanel() {
  const { activeFile, openFiles, setCurrentView, projectPath, addToast } = useAppStore();
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [mode, setMode] = useState<Mode>('preview');
  const [iframeKey, setIframeKey] = useState(0);
  const [content, setContent] = useState<string>('');

  const active = useMemo(() => openFiles.find((f) => f.path === activeFile), [openFiles, activeFile]);

  const resolveRelative = (baseDir: string, relativePath: string): string => {
    const parts = [...baseDir.split('/').filter(Boolean)];
    for (const seg of relativePath.replace(/\\/g, '/').split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts.join('/');
  };

  const readIfExists = async (path: string): Promise<string | null> => {
    try {
      return await window.electronAPI.file.readFile(path);
    } catch {
      return null;
    }
  };

  const buildHtmlPreview = async (filePath: string, html: string) => {
    if (!projectPath) return html;
    const baseDir = dirOf(filePath);

    let out = html;

    const linkRegex = /<link[^>]*rel=["']?stylesheet["']?[^>]*href=["']([^"']+)["'][^>]*>/gi;
    out = await replaceAsync(out, linkRegex, async (full, href) => {
      if (/^https?:\/\//i.test(href) || href.startsWith('data:')) return full;
      const rel = resolveRelative(baseDir, href);
      const css = await readIfExists(`${projectPath}/${rel}`);
      return css ? `<style data-source="${href}">${css}</style>` : full;
    });


    const filename = normalize(filePath).split('/').pop() || '';
    const stem = filename.replace(/\.[^.]+$/, '');
    const fallbackCss = (await readIfExists(`${projectPath}/${baseDir}/style.css`)) || (await readIfExists(`${projectPath}/${baseDir}/${stem}.css`));

    if (fallbackCss && !/<style|rel=["']?stylesheet/i.test(out)) {
      out = out.includes('</head>') ? out.replace('</head>', `<style>${fallbackCss}</style></head>`) : `<style>${fallbackCss}</style>${out}`;
    }

    return out;
  };

  const buildPreview = async () => {
    if (!active) return '';
    const ext = active.name.split('.').pop()?.toLowerCase();

    if (ext === 'md' || ext === 'markdown') {
      const html = await marked.parse(active.content || '');
      return sanitizePreviewHtml(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{font-family:Inter,system-ui,sans-serif;max-width:900px;margin:0 auto;padding:32px;line-height:1.65}pre{background:#111827;color:#e5e7eb;padding:16px;border-radius:10px;overflow:auto}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}</style></head><body>${html}</body></html>`);
    }

    if (ext === 'html' || ext === 'htm') {
      return sanitizePreviewHtml(await buildHtmlPreview(active.path, active.content || ''));
    }

    if (projectPath && (ext === 'css' || ext === 'js')) {
      const baseDir = dirOf(active.path);
      const stem = active.name.replace(/\.[^.]+$/, '');
      const html = (await readIfExists(`${projectPath}/${baseDir}/index.html`)) || (await readIfExists(`${projectPath}/${baseDir}/${stem}.html`));
      if (html) {
        const withAssets = await buildHtmlPreview(`${baseDir}/index.html`, html);
        if (ext === 'css') {
          const injected = withAssets.includes('</head>') ? withAssets.replace('</head>', `<style>${active.content}</style></head>`) : `<style>${active.content}</style>${withAssets}`;
          return sanitizePreviewHtml(injected);
        }
        return sanitizePreviewHtml(withAssets);
      }
    }

    return sanitizePreviewHtml(`<!doctype html><html><body style="font-family:Inter,system-ui;padding:24px"><h3>Preview unavailable</h3><p>Open an HTML/Markdown file, or keep HTML + CSS/JS in the same folder.</p><pre style="background:#111827;color:#e5e7eb;padding:16px;border-radius:8px;white-space:pre-wrap">${escapeHtml(active.content || '')}</pre></body></html>`);
  };

  useEffect(() => {
    const load = async () => setContent(await buildPreview());
    load();
  }, [active?.path, active?.content]);

  const openInChrome = async () => {
    try {
      const temp = await window.electronAPI.app.getPath('temp');
      const filePath = `${normalize(temp)}/kivode-preview-${Date.now()}.html`;
      await window.electronAPI.file.writeFile(filePath, content || '<html><body>No preview</body></html>');
      await window.electronAPI.shell.openInChrome(filePath);
    } catch (error: any) {
      addToast({ type: 'error', title: 'Open in Chrome Failed', message: error.message || 'Cannot open Chrome preview' });
    }
  };

  if (!active) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Open a file to preview.</div>;
  }

  const ext = active.name.split('.').pop()?.toLowerCase();
  const isMarkdown = ext === 'md' || ext === 'markdown';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('editor')}><ArrowLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">{active.name}</span>
        </div>

        <div className="flex items-center gap-1">
          {isMarkdown && (
            <>
              <Button size="sm" variant={mode === 'preview' ? 'secondary' : 'ghost'} onClick={() => setMode('preview')}><Eye className="mr-1 h-4 w-4" />Preview</Button>
              <Button size="sm" variant={mode === 'source' ? 'secondary' : 'ghost'} onClick={() => setMode('source')}><Code2 className="mr-1 h-4 w-4" />Source</Button>
            </>
          )}
          <Button size="icon" variant={device === 'desktop' ? 'secondary' : 'ghost'} onClick={() => setDevice('desktop')}><Monitor className="h-4 w-4" /></Button>
          <Button size="icon" variant={device === 'tablet' ? 'secondary' : 'ghost'} onClick={() => setDevice('tablet')}><Tablet className="h-4 w-4" /></Button>
          <Button size="icon" variant={device === 'mobile' ? 'secondary' : 'ghost'} onClick={() => setDevice('mobile')}><Smartphone className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setIframeKey((k) => k + 1)}><RotateCw className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={openInChrome}><ExternalLink className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/20 p-6">
        {mode === 'source' ? (
          <pre className="h-full w-full max-w-5xl overflow-auto rounded-xl border border-border bg-card p-4 text-xs">{content}</pre>
        ) : (
          <iframe
            key={iframeKey}
            title="preview"
            srcDoc={content}
            sandbox="allow-same-origin"
            className="rounded-xl border border-border bg-white shadow-2xl"
            style={{ width: `${deviceSizes[device].width}px`, height: `${deviceSizes[device].height}px`, maxWidth: '100%', maxHeight: '100%' }}
          />
        )}
      </div>
    </div>
  );
}

async function replaceAsync(input: string, regex: RegExp, replacer: (...args: any[]) => Promise<string>) {
  const matches = [...input.matchAll(regex)];
  let out = input;
  for (const m of matches) {
    const replacement = await replacer(...m);
    out = out.replace(m[0], replacement);
  }
  return out;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
