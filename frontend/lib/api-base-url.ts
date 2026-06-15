const API_PREFIX = '/api';

export function getApiBaseUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!rawUrl) {
    return process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api' : API_PREFIX;
  }

  const trimmedUrl = rawUrl.replace(/\/+$/, '');

  // Jika sudah berakhir dengan /api (atau /api/), kembalikan apa adanya.
  // Guard ini menghindari dobel `/api`.
  if (trimmedUrl === 'http://localhost:3001/api' || trimmedUrl.endsWith('/api')) {
    return trimmedUrl;
  }

  return `${trimmedUrl}${API_PREFIX}`;

}
