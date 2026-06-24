export interface IPaginationQuery {
  page?: number;
  limit?: number;
}

export interface IPaginationResult<T> {
  rows: T[];
  count: number;
  page: number;
  totalPages: number;
}

export interface ITelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}
