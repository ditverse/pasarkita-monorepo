const API_PREFIX = '/api';

export function getApiBaseUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!rawUrl) {
    return process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api' : API_PREFIX;
  }

  const trimmedUrl = rawUrl.replace(/\/+$/, '');

  if (trimmedUrl.endsWith(API_PREFIX)) {
    return trimmedUrl;
  }

  return `${trimmedUrl}${API_PREFIX}`;
}
