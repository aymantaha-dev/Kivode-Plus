export interface ParsedCommand {
  command: string;
  args: string[];
}

const ALLOWLIST = new Set(['python', 'python3', 'npm', 'node', 'git']);

export function parseCommand(input: string): ParsedCommand {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new Error('Command cannot be empty');

  if (tokens.some((token) => /[;&|`$><]/.test(token))) {
    throw new Error('Command contains forbidden shell metacharacters');
  }

  const [command, ...args] = tokens;
  if (!ALLOWLIST.has(command)) {
    throw new Error(`Command is not allowlisted: ${command}`);
  }

  return { command, args };
}
