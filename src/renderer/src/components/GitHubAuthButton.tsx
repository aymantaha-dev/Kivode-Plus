import { useState, useEffect } from 'react';
import { useAppStore } from '@renderer/stores/useAppStore';
import { Github, LogOut, Loader2, Key, X, Sparkles, ClipboardPaste } from 'lucide-react';

const AUTH_URL = 'https://github.com/settings/tokens';

export function GitHubAuthButton({ onAuthChange }: { onAuthChange?: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ login: string; avatar: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [activeMethod, setActiveMethod] = useState<'paste' | 'env'>('paste');
  const { addToast } = useAppStore();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const authenticated = await window.electronAPI.github.isAuthenticated();
    setIsAuthenticated(authenticated);

    if (authenticated) {
      const userData = await window.electronAPI.github.getUser();
      setUser(userData);
      const status = await window.electronAPI.github.getAuthStatus();
      setAuthStatus(status);
    } else {
      setAuthStatus(null);
    }
  };

  const tryLogin = async (value: string) => {
    if (!value.trim()) return;
    setIsLoading(true);
    try {
      await window.electronAPI.github.setAccessToken(value.trim());
      await checkAuthStatus();
      setIsDialogOpen(false);
      setToken('');
      onAuthChange?.();
      addToast({ type: 'success', title: 'GitHub Connected', message: 'Authentication successful.' });
    } catch (error: any) {
      addToast({ type: 'error', title: 'GitHub Login Failed', message: error?.message || 'Invalid token or missing permissions' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    const clip = await window.electronAPI.clipboard.readText();
    if (!clip) {
      addToast({ type: 'warning', title: 'Clipboard Empty', message: 'Copy a token first, then try again.' });
      return;
    }
    setToken(clip.trim());
    await tryLogin(clip);
  };

  const openTokenSettings = async () => {
    try {
      await window.electronAPI.shell.openExternal(AUTH_URL);
    } catch {
      // ignore to keep app stable
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.github.logout();
      setIsAuthenticated(false);
      setUser(null);
      onAuthChange?.();
      addToast({ type: 'success', title: 'GitHub Disconnected', message: 'Session removed from this device.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.login}</span>
          {authStatus?.tokenTypeHint && <span className="text-[11px] text-muted-foreground">{authStatus.tokenTypeHint === 'classic' ? 'Classic token' : 'Fine-grained/App token'}</span>}
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="inline-flex h-8 px-3 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <>
      <button className="inline-flex items-center gap-2 border border-input bg-background hover:bg-accent rounded-lg h-10 px-4" onClick={() => setIsDialogOpen(true)}>
        <Github className="w-4 h-4" />
        Connect GitHub
      </button>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[460px] bg-card border border-border rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sign in to GitHub</h2>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent" onClick={() => setIsDialogOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setActiveMethod('paste')} className={`px-3 py-2 rounded-lg text-sm ${activeMethod === 'paste' ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
                <Key className="inline w-4 h-4 mr-1" /> Paste token
              </button>
              <button onClick={() => setActiveMethod('env')} className={`px-3 py-2 rounded-lg text-sm ${activeMethod === 'env' ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
                <Sparkles className="inline w-4 h-4 mr-1" /> Token guide
              </button>
            </div>

            {activeMethod === 'paste' ? (
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="ghp_xxx / github_pat_xxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => tryLogin(token)} disabled={isLoading || !token.trim()} className="h-10 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Connect'}
                  </button>
                  <button onClick={handlePasteFromClipboard} disabled={isLoading} className="h-10 rounded-lg border border-input hover:bg-accent inline-flex items-center justify-center gap-2">
                    <ClipboardPaste className="w-4 h-4" /> Paste & connect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Use any token type supported by GitHub:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Fine-grained token (recommended)</li>
                  <li>Classic token with <code>repo</code> scope</li>
                  <li>GitHub App user token with repository write access</li>
                </ul>
                <button onClick={openTokenSettings} className="inline-flex items-center gap-1 text-primary hover:underline pt-1">
                  Open token settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
