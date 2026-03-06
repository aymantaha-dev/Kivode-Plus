const REMOTE_URL = /^https?:\/\//i;

export function sanitizePreviewHtml(input: string): string {
  let output = input;
  output = output.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  output = output.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  output = output.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  output = output.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  output = output.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
  output = output.replace(/<link[^>]+href=["']https?:[^>]+>/gi, '');
  output = output.replace(/<img([^>]+)src=["']https?:[^"']+["']([^>]*)>/gi, '<img$1$2>');
  return withCsp(output);
}

function withCsp(html: string): string {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; script-src 'none'; frame-src 'none';">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${csp}`);
  }
  return `<!doctype html><html><head>${csp}</head><body>${html}</body></html>`;
}

export function toSafeExternalUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!REMOTE_URL.test(trimmed)) return null;
  return trimmed;
}
