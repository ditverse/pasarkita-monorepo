type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
      error?: {
        code?: string;
        details?: Array<{ path: string[]; message: string }> | string;
        retry_after?: number;
      };
    };
  };
};

export function getApiError(error: unknown): ApiErrorLike {
  return error as ApiErrorLike;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = getApiError(error);
  const data = err.response?.data;
  
  if (data?.error?.details && Array.isArray(data.error.details)) {
    const details = data.error.details;
    if (details.length > 0) {
      return details.map(d => `${d.path.join('.')}: ${d.message}`).join(', ');
    }
  }
  
  return data?.message ?? fallback;
}
