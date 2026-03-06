import { useAppStore } from '@renderer/stores/useAppStore';
import { Button } from '@renderer/components/ui/button';
import { X, FileCode, FileJson, FileType, File as FileIcon } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@renderer/components/ui/scroll-area';
import { cn } from '@renderer/utils/helpers';

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return FileJson;
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return FileCode;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return FileType;
    default:
      return FileIcon;
  }
};

export function EditorTabs() {
  const { openFiles, setActiveFile, closeFile, saveFile } = useAppStore();

  if (openFiles.length === 0) {
    return null;
  }

  const handleClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const file = openFiles.find(f => f.path === path);
    if (file?.isModified) {
      const shouldSave = confirm(`Save changes to ${file.name}?`);
      if (shouldSave) {
        saveFile(path);
      }
    }
    closeFile(path);
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap border-b border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="flex">
        {openFiles.map((file) => {
          const FileIconComponent = getFileIcon(file.name);
          
          return (
            <div
              key={file.path}
              className={cn(
                "group flex items-center gap-2 px-4 py-2.5 border-r border-border/50 cursor-pointer transition-all duration-200 min-w-[140px] max-w-[220px] hover:bg-accent/30",
                file.isActive 
                  ? 'bg-primary/10 border-b-2 border-b-primary' 
                  : 'border-b-2 border-b-transparent'
              )}
              onClick={() => setActiveFile(file.path)}
            >
              <div className={cn(
                "w-5 h-5 rounded flex items-center justify-center flex-shrink-0",
                file.isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <FileIconComponent className="w-3 h-3" />
              </div>
              
              <span className={cn(
                "text-sm truncate flex-1",
                file.isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                file.isModified && 'italic'
              )}>
                {file.name}
              </span>

              {file.isModified && (
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  file.isActive ? 'bg-primary' : 'bg-primary/50'
                )} />
              )}

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-5 w-5 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0 hover:bg-red-500/10 hover:text-red-500",
                  file.isActive && 'opacity-100'
                )}
                onClick={(e) => handleClose(e, file.path)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" className="h-1.5" />
    </ScrollArea>
  );
}