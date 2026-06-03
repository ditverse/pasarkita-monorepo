type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
      error?: {
        code?: string;
        details?: string;
        retry_after?: number;
      };
    };
  };
};

export function getApiError(error: unknown): ApiErrorLike {
  return error as ApiErrorLike;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  return getApiError(error).response?.data?.message ?? fallback;
}
