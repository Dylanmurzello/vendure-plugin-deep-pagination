/**
 * Deep Pagination Plugin Types
 *
 * ENGINEERING DECISION: 2025-10-08
 * Proper infinite pagination using Elasticsearch's search_after cursor mechanism.
 * No arbitrary 10k limits. Built for scale.
 */

export interface CursorSearchInput {
  term?: string;
  facetValueIds?: string[];
  facetValueOperator?: 'AND' | 'OR';
  collectionId?: string;
  collectionSlug?: string;
  groupByProduct?: boolean;
  take?: number;
  cursor?: string; // Base64 encoded search_after values
  sort?: {
    name?: 'ASC' | 'DESC';
    price?: 'ASC' | 'DESC';
    createdAt?: 'ASC' | 'DESC';
  };
}

export interface CursorSearchResult<T> {
  items: T[];
  totalItems: number;
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export interface SearchAfterValues {
  values: any[]; // Sort values from last result
  sortFields: string[]; // Fields used for sorting (for consistency)
}
