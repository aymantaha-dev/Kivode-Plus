import { ToastMessage } from '@/types';

const URL_REGEX = /https?:\/\/\S+/gi;

const messageRules: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /name already exists on this account|repository\s+creation\s+failed.*name already exists/i,
    message: 'A repository with this name already exists in your GitHub account. Please choose a different name or publish to the existing repository.',
  },
  {
    pattern: /resource not accessible by personal access token|token lacks permission/i,
    message: 'Your GitHub token does not have enough permissions for this action. Update token permissions and try again.',
  },
  {
    pattern: /error invoking remote method/i,
    message: 'The requested action could not be completed. Please try again.',
  },
  {
    pattern: /access denied: path not allowed/i,
    message: 'Access to this path is not allowed.',
  },
  {
    pattern: /network error|econnaborted|timeout/i,
    message: 'Network connection issue. Please check your internet and try again.',
  },
];

function stripInternalDetails(raw: string): string {
  let out = (raw || '').trim();

  out = out.replace(/Error invoking remote method\s*'[^']+'\s*:\s*/gi, '');
  out = out.replace(/^(HttpError|Error)\s*:\s*/gi, '');
  out = out.replace(URL_REGEX, '').trim();

  // Remove bulky JSON fragments often appended by API errors
  out = out.replace(/\{[\s\S]*\}/g, '').trim();

  // Collapse whitespace
  out = out.replace(/\s{2,}/g, ' ').trim();

  return out;
}

export function formatUserMessage(message: string | undefined, fallback: string): string {
  const raw = (message || '').trim();

  for (const rule of messageRules) {
    if (rule.pattern.test(raw)) return rule.message;
  }

  const cleaned = stripInternalDetails(raw);
  if (!cleaned) return fallback;

  // keep message friendly and short
  if (cleaned.length > 220) {
    return `${cleaned.slice(0, 217).trimEnd()}...`;
  }

  return cleaned;
}

export function sanitizeToast(toast: Omit<ToastMessage, 'id'>): Omit<ToastMessage, 'id'> {
  const defaultByType: Record<ToastMessage['type'], string> = {
    error: 'Something went wrong. Please try again.',
    warning: 'Please review this action and try again.',
    info: 'Action completed.',
    success: 'Done successfully.',
  };

  return {
    ...toast,
    message: formatUserMessage(toast.message, defaultByType[toast.type]),
  };
}
