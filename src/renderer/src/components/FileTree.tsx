import { useState, useCallback } from 'react';
import { useAppStore } from '@renderer/stores/useAppStore';
import { FileNode } from '@renderer/types';
import { cn } from '@renderer/utils/helpers';
import { BrandLogo } from '@renderer/components/BrandLogo';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, FileCode, FileJson, FileType, MoreVertical, Plus, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@renderer/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';

type TreeDialogMode = 'rename' | 'new-file' | 'new-folder' | null;

interface TreeDialogState {
  open: boolean;
  mode: TreeDialogMode;
  node: FileNode | null;
  name: string;
  extension: string;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  onToggle: (path: string) => void;
  expandedPaths: Set<string>;
  openDialog: (mode: Exclude<TreeDialogMode, null>, node: FileNode) => void;
  onDelete: (node: FileNode) => Promise<void>;
}

const EXTENSIONS = [
  { value: 'txt', label: 'Text (txt)' },
  { value: 'md', label: 'Markdown (md)' },
  { value: 'html', label: 'HTML (html)' },
  { value: 'css', label: 'CSS (css)' },
  { value: 'scss', label: 'SCSS (scss)' },
  { value: 'js', label: 'JavaScript (js)' },
  { value: 'jsx', label: 'JSX (jsx)' },
  { value: 'ts', label: 'TypeScript (ts)' },
  { value: 'tsx', label: 'TSX (tsx)' },
  { value: 'json', label: 'JSON (json)' },
  { value: 'yml', label: 'YAML (yml)' },
  { value: 'xml', label: 'XML (xml)' },
  { value: 'py', label: 'Python (py)' },
  { value: 'sh', label: 'Shell (sh)' },
  { value: 'sql', label: 'SQL (sql)' },
  { value: 'vue', label: 'Vue (vue)' },
  { value: 'svelte', label: 'Svelte (svelte)' },
];

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'json') return <FileJson className="w-4 h-4 text-yellow-500" />;
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) return <FileCode className="w-4 h-4 text-blue-500" />;
  if (['css', 'scss', 'sass', 'less'].includes(ext || '')) return <FileType className="w-4 h-4 text-sky-500" />;
  if (['html', 'htm'].includes(ext || '')) return <FileCode className="w-4 h-4 text-orange-500" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
};

function TreeNode({ node, depth, onToggle, expandedPaths, openDialog, onDelete }: TreeNodeProps) {
  const { openFile, activeFile, openFiles } = useAppStore();
  const isExpanded = expandedPaths.has(node.path);
  const isActive = activeFile === node.path;
  const isOpen = openFiles.some((f) => f.path === node.path);

  const handleClick = () => {
    if (node.type === 'directory') onToggle(node.path);
    else openFile(node);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-2 transition-all duration-200 hover:bg-accent/50',
          isActive && 'bg-primary/15 text-primary shadow-sm',
          isOpen && !isActive && 'bg-primary/5 text-foreground'
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' ? (
          <span className="flex h-4 w-4 items-center justify-center">{isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}</span>
        ) : (
          <span className="w-4" />
        )}

        <div className={cn('flex h-5 w-5 items-center justify-center rounded-md', node.type === 'directory' && isExpanded && 'bg-amber-500/10', node.type === 'directory' && !isExpanded && 'bg-primary/10')}>
          {node.type === 'directory' ? isExpanded ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-primary" /> : getFileIcon(node.name)}
        </div>

        <span className={cn('flex-1 truncate text-sm', isActive && 'font-medium')}>{node.name}</span>

        <div className="opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-primary/10">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/50">
              {node.type === 'directory' && (
                <>
                  <DropdownMenuItem className="cursor-pointer rounded-lg text-xs" onClick={() => openDialog('new-file', node)}><Plus className="mr-2 h-3.5 w-3.5 text-emerald-500" />New File</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer rounded-lg text-xs" onClick={() => openDialog('new-folder', node)}><Folder className="mr-2 h-3.5 w-3.5 text-primary" />New Folder</DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem className="cursor-pointer rounded-lg text-xs" onClick={() => openDialog('rename', node)}><Edit3 className="mr-2 h-3.5 w-3.5 text-blue-500" />Rename</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-lg text-xs text-destructive focus:text-destructive" onClick={() => onDelete(node)}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      <AnimatePresence>
        {node.type === 'directory' && isExpanded && node.children && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} onToggle={onToggle} expandedPaths={expandedPaths} openDialog={openDialog} onDelete={onDelete} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FileTree() {
  const { fileTree, projectPath, refreshFileTree, projectName, addToast, openFile } = useAppStore();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<TreeDialogState>({ open: false, mode: null, node: null, name: '', extension: 'txt' });

  const normalizePath = (path: string) => path.replace(/\\/g, '/');
  const getParentPath = (path: string) => {
    const normalized = normalizePath(path);
    const idx = normalized.lastIndexOf('/');
    return idx > 0 ? normalized.slice(0, idx) : normalized;
  };
  const joinPath = (base: string, name: string) => `${normalizePath(base).replace(/\/$/, '')}/${name}`;

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const openDialog = (mode: Exclude<TreeDialogMode, null>, node: FileNode) => {
    const name = mode === 'rename' ? node.name : '';
    setDialog({ open: true, mode, node, name, extension: 'txt' });
  };

  const closeDialog = () => setDialog({ open: false, mode: null, node: null, name: '', extension: 'txt' });

  const submitDialog = async () => {
    if (!dialog.node || !dialog.mode) return;
    const baseName = dialog.name.trim();
    if (!baseName) return;

    try {
      if (dialog.mode === 'rename') {
        const parentPath = getParentPath(dialog.node.path);
        await window.electronAPI.file.renameFile(dialog.node.path, joinPath(parentPath, baseName));
        addToast({ type: 'success', title: 'Renamed', message: `Renamed to ${baseName}` });
      }

      if (dialog.mode === 'new-folder') {
        const parent = dialog.node.type === 'directory' ? dialog.node.path : getParentPath(dialog.node.path);
        await window.electronAPI.file.createDirectory(joinPath(parent, baseName));
        addToast({ type: 'success', title: 'Created', message: `Folder ${baseName} created` });
      }

      if (dialog.mode === 'new-file') {
        const parent = dialog.node.type === 'directory' ? dialog.node.path : getParentPath(dialog.node.path);
        const filename = baseName.includes('.') ? baseName : `${baseName}.${dialog.extension}`;
        const fullPath = joinPath(parent, filename);
        await window.electronAPI.file.writeFile(fullPath, '');
        addToast({ type: 'success', title: 'Created', message: `File ${filename} created` });
        await openFile({ name: filename, path: fullPath, type: 'file', lastModified: new Date() } as FileNode);
      }

      await refreshFileTree();
      closeDialog();
    } catch (error: any) {
      addToast({ type: 'error', title: 'Action Failed', message: error.message || 'Operation failed' });
    }
  };

  const handleDelete = async (node: FileNode) => {
    try {
      if (node.type === 'directory') {
        addToast({ type: 'warning', title: 'Directory delete', message: 'Directory delete is not enabled currently' });
        return;
      }
      await window.electronAPI.file.deleteFile(node.path);
      await refreshFileTree();
      addToast({ type: 'success', title: 'Deleted', message: `${node.name} deleted` });
    } catch (error: any) {
      addToast({ type: 'error', title: 'Delete Failed', message: error.message || 'Delete failed' });
    }
  };

  const expandAll = () => {
    const all = new Set<string>();
    const walk = (nodes: FileNode[]) => nodes.forEach((n) => { if (n.type === 'directory') { all.add(n.path); if (n.children) walk(n.children); } });
    walk(fileTree);
    setExpandedPaths(all);
  };

  if (!projectPath) {
    return <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">Open a project to browse files.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 bg-card/20 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 p-1"><BrandLogo className="h-full w-full text-primary" /></div>
          <span className="max-w-[120px] truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{projectName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={expandAll} title="Expand all"><ChevronDown className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setExpandedPaths(new Set())} title="Collapse all"><ChevronRight className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openDialog('new-file', { path: projectPath, name: '', type: 'directory', lastModified: new Date() } as FileNode)} title="New file"><Plus className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openDialog('new-folder', { path: projectPath, name: '', type: 'directory', lastModified: new Date() } as FileNode)} title="New folder"><Folder className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={refreshFileTree} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {fileTree.map((node) => <TreeNode key={node.path} node={node} depth={0} onToggle={handleToggle} expandedPaths={expandedPaths} openDialog={openDialog} onDelete={handleDelete} />)}
      </div>

      {dialog.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={closeDialog}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">
              {dialog.mode === 'rename' ? 'Rename' : dialog.mode === 'new-file' ? 'Create New File' : 'Create New Folder'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">Enter a name and confirm the action.</p>

            <div className="mt-4 space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={dialog.name} onChange={(e) => setDialog((prev) => ({ ...prev, name: e.target.value }))} placeholder={dialog.mode === 'new-folder' ? 'components' : 'index'} />
              </div>

              {dialog.mode === 'new-file' && (
                <div>
                  <Label>Extension</Label>
                  <Select value={dialog.extension} onValueChange={(v) => setDialog((prev) => ({ ...prev, extension: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                      {EXTENSIONS.map((ext) => <SelectItem key={ext.value} value={ext.value}>{ext.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={submitDialog}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
