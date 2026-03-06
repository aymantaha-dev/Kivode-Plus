import { app } from 'electron';
import path from 'path';

const SENSITIVE_SEGMENTS = [
  '/etc', '/bin', '/sbin', '/usr', '/sys', '/proc', '/dev', '/root',
  'c:\\windows', 'c:\\program files', 'c:\\program files (x86)', 'c:\\programdata', 'c:\\users\\default'
];

export class FilesystemPolicy {
  private readonly roots: string[];

  constructor(additionalRoots: string[] = []) {
    const baseRoots = [
      app.getPath('userData'),
      app.getPath('appData'),
      app.getPath('temp'),
      app.getPath('documents'),
      app.getPath('downloads'),
      ...additionalRoots,
    ].map((entry) => path.resolve(entry));

    this.roots = [...new Set(baseRoots)];
  }

  isAllowed(targetPath: string): boolean {
    const normalized = path.resolve(targetPath);
    const normalizedLower = normalized.toLowerCase();

    if (SENSITIVE_SEGMENTS.some((segment) => normalizedLower === segment || normalizedLower.startsWith(`${segment}${path.sep}`))) {
      return false;
    }

    return this.roots.some((root) => normalized === root || normalized.startsWith(`${root}${path.sep}`));
  }

  assertAllowed(targetPath: string): void {
    if (!this.isAllowed(targetPath)) {
      throw new Error(`Access denied by filesystem policy: ${targetPath}`);
    }
  }

  getRoots(): string[] {
    return [...this.roots];
  }
}
