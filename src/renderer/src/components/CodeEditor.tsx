import { useCallback, useEffect, useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { linter, type Diagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { useAppStore } from '@renderer/stores/useAppStore';
import { Button } from '@renderer/components/ui/button';
import { cn } from '@renderer/utils/helpers';
import { 
  Save, 
  RotateCcw, 
  Copy, 
  Scissors,
  Clipboard,
  Type,
  WrapText,
  FileOutput,
  Sun,
  Moon,
  FileCode,
  Sparkles,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ts from 'typescript';

// Prettier integration for formatting.

function getLanguageExtension(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return javascript({ jsx: true, typescript: false });
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'py':
      return python();
    case 'html':
    case 'htm':
      return html();
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return css();
    case 'json':
      return json();
    case 'md':
    case 'markdown':
      return markdown();
    default:
      return [];
  }
}

function getLanguageName(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', html: 'html', htm: 'html', css: 'css',
    scss: 'scss', sass: 'sass', less: 'less', json: 'json',
    md: 'markdown', txt: 'plaintext', xml: 'xml', yaml: 'yaml',
    yml: 'yaml', sql: 'sql', sh: 'shell', bash: 'shell',
    ps1: 'powershell', dockerfile: 'dockerfile', env: 'dotenv',
    gitignore: 'gitignore', gitattributes: 'gitattributes',
  };
  return map[ext || ''] || ext || 'plaintext';
}


function createBasicDiagnostics(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();

  return linter((view): Diagnostic[] => {
    const text = view.state.doc.toString();
    const diagnostics: Diagnostic[] = [];

    if (ext === 'json') {
      try {
        JSON.parse(text);
      } catch (error: any) {
        diagnostics.push({
          from: 0,
          to: Math.min(text.length, 1),
          severity: 'error',
          message: error?.message || 'Invalid JSON syntax',
        });
      }
    }

    if (['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx'].includes(ext || '')) {
      const result = ts.transpileModule(text, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          allowJs: true,
          checkJs: true,
        },
        fileName: filename,
        reportDiagnostics: true,
      });

      for (const d of result.diagnostics || []) {
        const from = Math.max(0, d.start || 0);
        const to = Math.max(from + 1, from + (d.length || 1));
        const message = ts.flattenDiagnosticMessageText(d.messageText, '\\n');
        diagnostics.push({
          from,
          to,
          severity: d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
          message,
        });
      }
    }

    if ((ext === 'html' || ext === 'htm') && !text.includes('<html')) {
      diagnostics.push({
        from: 0,
        to: Math.min(text.length, 1),
        severity: 'warning',
        message: 'Tip: add a full HTML document structure for better preview behavior.',
      });
    }

    return diagnostics;
  });
}

// Formats source code with Prettier.
async function formatCode(code: string, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase();

  let parser: string | null = null;
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext || '')) parser = 'babel';
  if (['ts', 'tsx'].includes(ext || '')) parser = 'typescript';
  if (['html', 'htm'].includes(ext || '')) parser = 'html';
  if (['css', 'scss', 'sass', 'less'].includes(ext || '')) parser = 'css';
  if (ext === 'json') parser = 'json';

  if (!parser) {
    throw new Error('Language not supported for formatting');
  }

  try {
    const prettier = await import('prettier/standalone');
    const babelPlugin = await import('prettier/plugins/babel');
    const estreePlugin = await import('prettier/plugins/estree');
    const typescriptPlugin = await import('prettier/plugins/typescript');
    const htmlPlugin = await import('prettier/plugins/html');
    const postcssPlugin = await import('prettier/plugins/postcss');

    const formatted = await prettier.format(code, {
      parser,
      plugins: [babelPlugin, estreePlugin, typescriptPlugin, htmlPlugin, postcssPlugin],
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5',
      printWidth: 100,
    });

    return formatted;
  } catch (error) {
    console.error('Format error:', error);
    throw error;
  }
}

export function CodeEditor() {
  const {
    activeFile,
    openFiles,
    updateFileContent,
    saveFile,
    settings,
    updateSettings,
    theme,
    toggleTheme,
    addToast,
    projectPath,
    projectName,
    exportProject,
    isGenerating,
  } = useAppStore();

  const [wordWrap, setWordWrap] = useState(settings.wordWrap);
  const [editorTheme, setEditorTheme] = useState(theme);
  const [isFormatting, setIsFormatting] = useState(false);
  
  const editorRef = useRef<any>(null);
  const activeFileData = openFiles.find(f => f.path === activeFile);

  const writeClipboardText = async (text: string) => {
    try {
      if (window.electronAPI?.clipboard?.writeText) {
        window.electronAPI.clipboard.writeText(text);
        return;
      }
    } catch {}

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {}

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  };

  const readClipboardText = async (): Promise<string> => {
    try {
      if (window.electronAPI?.clipboard?.readText) {
        const text = await window.electronAPI.clipboard.readText();
        if (typeof text === 'string') return text;
      }
    } catch {}

    try {
      if (navigator.clipboard?.readText) {
        return await navigator.clipboard.readText();
      }
    } catch {}

    return '';
  };

  useEffect(() => {
    setEditorTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!settings.autoSave || !activeFileData?.isModified || !activeFile) return;
    const t = setTimeout(() => {
      saveFile(activeFile).catch(() => undefined);
    }, 900);
    return () => clearTimeout(t);
  }, [activeFileData?.content, activeFileData?.isModified, settings.autoSave, activeFile]);

  const handleChange = useCallback((value: string) => {
    if (activeFile) {
      updateFileContent(activeFile, value);
    }
  }, [activeFile, updateFileContent]);

  const handleSave = async () => {
    if (activeFile) {
      try {
        await saveFile(activeFile);
        addToast({
          type: 'success',
          title: 'Saved',
          message: 'File saved successfully',
          duration: 2000,
        });
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Save Failed',
          message: 'Failed to save file',
        });
      }
    }
  };

  const handleExportProject = async () => {
    if (!projectPath || openFiles.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Project',
        message: 'Open a project first to export',
      });
      return;
    }

    try {
      const result = await window.electronAPI.file.selectFolder();
      
      if (!result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const exportPath = result.filePaths[0];
      const folderName = projectName || 'exported-project';
      const finalExportPath = `${exportPath}/${folderName}`;

      await exportProject(finalExportPath);

    } catch (error: any) {
      // Error handled in store
    }
  };

  // Copies selected text using the Electron clipboard bridge.
  const handleCopy = async () => {
    if (!activeFileData?.content) {
      addToast({
        type: 'warning',
        title: 'Nothing to Copy',
        message: 'File is empty',
      });
      return;
    }

    try {
      await writeClipboardText(activeFileData.content || '');
      
      addToast({
        type: 'success',
        title: 'Copied',
        message: 'File content copied to clipboard',
        duration: 2000,
      });
    } catch (err) {
      console.error('Copy error:', err);
      addToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Failed to copy content to clipboard',
      });
    }
  };

  // Cuts selected text using the Electron clipboard bridge.
  const handleCut = async () => {
    if (!activeFileData?.content || !activeFile) {
      addToast({
        type: 'warning',
        title: 'Nothing to Cut',
        message: 'File is empty',
      });
      return;
    }

    try {
      // Copy content first.
      await writeClipboardText(activeFileData.content || '');
      
      // Clear content.
      updateFileContent(activeFile, '');
      
      addToast({
        type: 'success',
        title: 'Cut',
        message: 'Content cut to clipboard',
        duration: 2000,
      });
    } catch (err) {
      console.error('Cut error:', err);
      addToast({
        type: 'error',
        title: 'Cut Failed',
        message: 'Failed to cut content',
      });
    }
  };

  // Pastes clipboard text using the Electron clipboard bridge.
  const handlePaste = async () => {
    if (!activeFile) return;

    try {
      const text = await readClipboardText();
      
      if (!text) {
        addToast({
          type: 'warning',
          title: 'Nothing to Paste',
          message: 'Clipboard is empty',
        });
        return;
      }
      
      const newContent = activeFileData?.content 
        ? activeFileData.content + text 
        : text;
      updateFileContent(activeFile, newContent);
      
      addToast({
        type: 'success',
        title: 'Pasted',
        message: 'Content pasted successfully',
        duration: 2000,
      });
    } catch (err) {
      console.error('Paste error:', err);
      addToast({
        type: 'error',
        title: 'Paste Failed',
        message: 'Failed to paste content. Try using Ctrl+V',
      });
    }
  };

  // Applies Prettier formatting to the current document.
  const handleFormat = async () => {
    if (!activeFileData?.content || !activeFile) {
      addToast({
        type: 'warning',
        title: 'Nothing to Format',
        message: 'File is empty',
      });
      return;
    }

    setIsFormatting(true);
    
    try {
      const formatted = await formatCode(activeFileData.content, activeFileData.name);
      updateFileContent(activeFile, formatted);
      
      addToast({
        type: 'success',
        title: 'Formatted',
        message: 'Code formatted successfully',
        duration: 2000,
      });
    } catch (error: any) {
      console.error('Format error:', error);
      addToast({
        type: 'error',
        title: 'Format Failed',
        message: error.message || 'Failed to format code. Language may not be supported.',
      });
    } finally {
      setIsFormatting(false);
    }
  };

  const handleReset = async () => {
    if (activeFileData) {
      try {
        const originalContent = await window.electronAPI.file.readFile(activeFileData.path);
        updateFileContent(activeFileData.path, originalContent);
        addToast({
          type: 'success',
          title: 'Reset',
          message: 'File content reset to original',
          duration: 2000,
        });
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to reset file content',
        });
      }
    }
  };

  const handleToggleTheme = () => {
    const newTheme = editorTheme === 'dark' ? 'light' : 'dark';
    setEditorTheme(newTheme);
    toggleTheme();
    updateSettings({ theme: newTheme });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, activeFileData]);

  if (!activeFileData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg shadow-primary/10"
          >
            <FileCode className="w-12 h-12 text-primary/40" />
          </motion.div>
          <h3 className="text-xl font-semibold mb-2">No File Open</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Select a file from the explorer to start editing
          </p>
        </div>
      </div>
    );
  }

  const languageExtension = getLanguageExtension(activeFileData.name);
  const languageName = getLanguageName(activeFileData.name);
  const diagnosticsExtension = createBasicDiagnostics(activeFileData.name);

  const toolbarButtons = [
    { 
      icon: Save, 
      label: 'Save', 
      onClick: handleSave, 
      disabled: !activeFileData.isModified, 
      shortcut: 'Ctrl+S' 
    },
    { 
      icon: FileOutput, 
      label: 'Export', 
      onClick: handleExportProject 
    },
    null,
    { 
      icon: editorTheme === 'dark' ? Sun : Moon, 
      label: 'Theme', 
      onClick: handleToggleTheme 
    },
    { 
      icon: isFormatting ? Check : Type, 
      label: 'Format', 
      onClick: handleFormat,
      disabled: isFormatting,
      loading: isFormatting
    },
    null,
    { 
      icon: Copy, 
      label: 'Copy', 
      onClick: handleCopy 
    },
    { 
      icon: Scissors, 
      label: 'Cut', 
      onClick: handleCut 
    },
    { 
      icon: Clipboard, 
      label: 'Paste', 
      onClick: handlePaste 
    },
    null,
    { 
      icon: WrapText, 
      label: 'Wrap', 
      onClick: () => setWordWrap(!wordWrap), 
      active: wordWrap 
    },
    { 
      icon: RotateCcw, 
      label: 'Reset', 
      onClick: handleReset 
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <FileCode className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {activeFileData.name}
            </span>
            {activeFileData.isModified && (
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {toolbarButtons.map((btn, index) => {
            if (!btn) return <div key={`sep-${index}`} className="w-px h-4 bg-border/50 mx-1" />;
            const Icon = btn.icon;
            const isActive = 'active' in btn && btn.active;
            const isLoading = 'loading' in btn && btn.loading;
            const isDisabled = 'disabled' in btn ? btn.disabled : false;
            
            return (
              <Button
                key={btn.label}
                variant={isActive ? 'secondary' : 'ghost'}
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg transition-all duration-200",
                  isActive && "bg-primary/10 text-primary",
                  isLoading && "animate-pulse"
                )}
                onClick={btn.onClick}
                disabled={isDisabled || isLoading}
                title={`${btn.label}${'shortcut' in btn && btn.shortcut ? ` (${btn.shortcut})` : ''}`}
              >
                <Icon className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            );
          })}
        </div>
      </div>

      {/* CodeMirror Editor */}
      <div className="flex-1 overflow-hidden relative">
        {isGenerating && (
          <div className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg bg-primary/90 text-primary-foreground text-xs font-medium shadow-lg animate-pulse">
            AI is editing…
          </div>
        )}
        <CodeMirror
          key={activeFileData.path}
          value={activeFileData.content || ''}
          height="100%"
          theme={editorTheme === 'dark' ? oneDark : 'light'}
          extensions={[languageExtension, diagnosticsExtension, EditorState.tabSize.of(settings.tabSize || 2)]}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: true,
            lineWrapping: wordWrap,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          style={{
            fontSize: `${settings.fontSize || 14}px`,
            height: '100%',
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-card/30 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-4">
          <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
            {languageName.toUpperCase()}
          </span>
          <span className="text-muted-foreground">UTF-8</span>
          <span className={cn("text-muted-foreground", wordWrap && "text-primary")}>
            {wordWrap ? 'WRAP' : 'NO WRAP'}
          </span>
          {activeFileData.isModified && (
            <span className="text-primary font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              MODIFIED
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>{(activeFileData.content || '').split('\n').length} lines</span>
          <span>{(activeFileData.content || '').length} chars</span>
        </div>
      </div>
    </div>
  );
}
