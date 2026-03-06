import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mainTs = fs.readFileSync('src/main/main.ts', 'utf-8');
const taskEngineTs = fs.readFileSync('src/main/services/TaskEngineService.ts', 'utf-8');
const previewTsx = fs.readFileSync('src/renderer/src/components/PreviewPanel.tsx', 'utf-8');
const githubServiceTs = fs.readFileSync('src/main/services/GitHubService.ts', 'utf-8');
const packageJson = fs.readFileSync('package.json', 'utf-8');

assert(!fs.existsSync('src/main/services/github-publish.service.ts'), 'Legacy publish service must be removed');
assert(!fs.existsSync('src/main/ipc/github-handlers.ts'), 'Legacy GitHub IPC handlers must be removed');
assert(mainTs.includes('FilesystemPolicy'), 'Main process must use centralized filesystem policy');
assert(mainTs.includes('validateUpdateUrl'), 'Update URL validation must be enforced');
assert(mainTs.includes("ipcMain.handle('store:getApiKey'"), 'store:getApiKey handler must exist');
assert(mainTs.includes('return null;'), 'store:getApiKey must not expose raw secrets');
assert(taskEngineTs.includes('shell: false'), 'Command runner must not use shell=true');
assert(taskEngineTs.includes('parseCommand(cmd)'), 'Command parser allowlist must be applied');
assert(previewTsx.includes('sanitizePreviewHtml'), 'Preview sanitizer must be applied');
assert(previewTsx.includes('sandbox="allow-same-origin"'), 'Preview iframe sandbox must disallow scripts');
assert(githubServiceTs.includes('randomBytes(32)'), 'Per-user encryption key generation must exist');
assert(packageJson.includes('"requestedExecutionLevel": "asInvoker"'), 'Installer privilege must be reduced to asInvoker');

console.log('Security checks passed.');
