import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { diffLines } from 'diff';
import { FileNode, ProjectMetrics } from '@renderer/types';

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function getLanguageIcon(language: string): string {
  const icons: { [key: string]: string } = {
    javascript: '⚡',
    typescript: '🔷',
    python: '🐍',
    java: '☕',
    csharp: '🔷',
    cpp: '⚙️',
    c: '⚙️',
    html: '🌐',
    css: '🎨',
    scss: '🎨',
    json: '📋',
    markdown: '📝',
    sql: '🗄️',
    shell: '💻',
    yaml: '📄',
    xml: '📄',
    php: '🐘',
    ruby: '💎',
    go: '🐹',
    rust: '⚙️',
    swift: '🦉',
    kotlin: '🎯',
    dart: '🎯',
    vue: '💚',
    svelte: '🧡',
  };

  return icons[language] || '📄';
}

export function getLanguageColor(language: string): string {
  const colors: { [key: string]: string } = {
    javascript: '#f7df1e',
    typescript: '#3178c6',
    python: '#3776ab',
    java: '#007396',
    csharp: '#239120',
    cpp: '#00599c',
    c: '#555555',
    html: '#e34c26',
    css: '#264de4',
    scss: '#cc6699',
    json: '#292929',
    markdown: '#083fa1',
    sql: '#336791',
    shell: '#89e051',
    yaml: '#cb171e',
    xml: '#0060ac',
    php: '#777bb4',
    ruby: '#cc342d',
    go: '#00add8',
    rust: '#dea584',
    swift: '#ffac45',
    kotlin: '#7f52ff',
    dart: '#0175c2',
    vue: '#4fc08d',
    svelte: '#ff3e00',
  };

  return colors[language] || '#888888';
}

export function countLines(content: string): number {
  return content.split('\n').length;
}

export function estimateComplexity(content: string, language: string): number {
  const patterns: { [key: string]: RegExp } = {
    javascript: /\b(if|else|for|while|switch|case|catch|try|finally)\b/g,
    typescript: /\b(if|else|for|while|switch|case|catch|try|finally)\b/g,
    python: /\b(if|else|elif|for|while|try|except|finally|with)\b/g,
    java: /\b(if|else|for|while|switch|case|catch|try|finally)\b/g,
    csharp: /\b(if|else|for|while|switch|case|catch|try|finally)\b/g,
  };

  const pattern = patterns[language];
  if (!pattern) return 0;

  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

export function findFileInTree(tree: FileNode[], path: string): FileNode | null {
  for (const node of tree) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findFileInTree(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function flattenFileTree(tree: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  
  function traverse(node: FileNode) {
    result.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  tree.forEach(traverse);
  return result;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
  return imageExtensions.includes(getFileExtension(filename));
}

export function isPreviewable(filename: string): boolean {
  const previewableExtensions = ['html', 'htm', 'md', 'markdown', 'svg'];
  return previewableExtensions.includes(getFileExtension(filename));
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadFile(content: string, filename: string, type: string = 'text/plain'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseDiff(oldContent: string, newContent: string): Array<{
  type: 'add' | 'remove' | 'unchanged';
  oldLine?: number;
  newLine?: number;
  content: string;
}> {
  const result: Array<{
    type: 'add' | 'remove' | 'unchanged';
    oldLine?: number;
    newLine?: number;
    content: string;
  }> = [];

  let oldLineNumber = 1;
  let newLineNumber = 1;

  const changes = diffLines(oldContent, newContent);
  for (const change of changes) {
    const lines = change.value.split('\n');
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }

    for (const line of lines) {
      if (change.added) {
        result.push({ type: 'add', newLine: newLineNumber, content: line });
        newLineNumber++;
      } else if (change.removed) {
        result.push({ type: 'remove', oldLine: oldLineNumber, content: line });
        oldLineNumber++;
      } else {
        result.push({
          type: 'unchanged',
          oldLine: oldLineNumber,
          newLine: newLineNumber,
          content: line,
        });
        oldLineNumber++;
        newLineNumber++;
      }
    }
  }

  return result;
}

export function calculateMetricsSummary(metrics: ProjectMetrics): {
  health: 'good' | 'fair' | 'poor';
  score: number;
  suggestions: string[];
} {
  let score = 100;
  const suggestions: string[] = [];

  if (metrics.complexity.averageComplexity > 15) {
    score -= 20;
    suggestions.push('High complexity detected. Consider refactoring complex functions.');
  }

  if (metrics.totalFiles > 100) {
    score -= 10;
    suggestions.push('Large project. Consider modularizing into smaller packages.');
  }

  const avgLinesPerFile = metrics.totalLines / metrics.totalFiles;
  if (avgLinesPerFile > 500) {
    score -= 15;
    suggestions.push('Some files are quite large. Consider splitting them.');
  }

  const languageCount = Object.keys(metrics.languages).length;
  if (languageCount > 5) {
    score -= 10;
    suggestions.push('Many languages detected. Consider standardizing the tech stack.');
  }

  const health = score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor';

  return { health, score: Math.max(0, score), suggestions };
}
