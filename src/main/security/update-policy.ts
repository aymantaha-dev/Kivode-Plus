const ALLOWED_UPDATE_DOMAINS = ['aymantaha-dev.github.io'];

export function validateUpdateUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== 'https:') {
    throw new Error('Update URL must use HTTPS');
  }

  if (!ALLOWED_UPDATE_DOMAINS.includes(parsed.hostname.toLowerCase())) {
    throw new Error('Update URL domain is not allowlisted');
  }

  return parsed;
}

export function getAllowedUpdateDomains(): string[] {
  return [...ALLOWED_UPDATE_DOMAINS];
}
