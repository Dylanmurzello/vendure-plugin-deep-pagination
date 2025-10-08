/**
 * Deep Pagination Service
 *
 * ARCHITECTURE: 2025-10-08
 * Implements Elasticsearch search_after for infinite scroll/pagination.
 * Deterministic sorting with createdAt + _id fallback ensures consistency.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { RequestContext } from '@vendure/core';
import { ELASTICSEARCH_CLIENT } from './constants';
import { CursorSearchInput, CursorSearchResult, SearchAfterValues } from './types';

@Injectable()
export class DeepPaginationService {
  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private client: Client,
    @Inject('ELASTICSEARCH_INDEX_PREFIX') private indexPrefix: string,
  ) {}

  /**
   * Execute cursor-based search using Elasticsearch search_after
   */
  async cursorSearch(
    ctx: RequestContext,
    input: CursorSearchInput,
  ): Promise<CursorSearchResult<any>> {
    const take = Math.min(input.take || 100, 1000); // Cap at 1000 per request

    // FIX: 2025-10-08 - Vendure uses 'variants' index with timestamp suffix
    // Use wildcard pattern to match any version (e.g., gbrosvariants1759542014230)
    const indexPattern = `${this.indexPrefix}variants*`;

    // Decode cursor if provided
    const searchAfter = input.cursor ? this.decodeCursor(input.cursor) : undefined;

    // Build sort criteria (MUST be deterministic for search_after to work)
    const sort = this.buildSort(input.sort);

    // Build query
    const query = this.buildQuery(input);

    try {
      const response = await this.client.search({
        index: indexPattern,
        query,
        sort,
        size: take + 1, // Fetch one extra to determine if there's more
        search_after: searchAfter?.values,
        track_total_hits: true, // Get accurate total count
      });

      const hits = response.hits.hits;
      const totalItems = typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || 0;

      // Check if there are more results
      const hasMore = hits.length > take;
      const items = hasMore ? hits.slice(0, take) : hits;

      // Generate next cursor from last item's sort values
      const nextCursor = hasMore && items.length > 0
        ? this.encodeCursor({
            values: items[items.length - 1].sort || [],
            sortFields: sort.map((s: any) => Object.keys(s)[0]),
          })
        : undefined;

      // Map ES results to Vendure SearchResult format
      const mappedItems = items.map((hit: any) => {
        const source = hit._source;

        // Format price according to Vendure's SearchResult schema
        const priceMin = source.productPriceWithTaxMin || source.priceWithTax;
        const priceMax = source.productPriceWithTaxMax || source.priceWithTax;
        const priceWithTax = priceMin === priceMax
          ? { __typename: 'SinglePrice', value: priceMin }
          : { __typename: 'PriceRange', min: priceMin, max: priceMax };

        return {
          productId: source.productId,
          productName: source.productName,
          slug: source.slug,
          description: source.description,
          productAsset: source.productAssetId
            ? {
                id: source.productAssetId.toString(),
                preview: source.productPreview,
              }
            : null,
          priceWithTax,
          currencyCode: source.currencyCode,
          facetValueIds: source.facetValueIds || [],
          collectionIds: source.collectionIds || [],
          score: hit._score,
        };
      });

      return {
        items: mappedItems,
        totalItems,
        hasMore,
        nextCursor,
        prevCursor: undefined, // Previous cursor requires reverse sort (implement if needed)
      };
    } catch (error) {
      console.error('[DeepPagination] Search failed:', error);
      throw error;
    }
  }

  /**
   * Build Elasticsearch query from input
   */
  private buildQuery(input: CursorSearchInput): any {
    const must: any[] = [];
    const filter: any[] = [];

    // Text search
    if (input.term) {
      must.push({
        multi_match: {
          query: input.term,
          fields: ['productName^3', 'description', 'sku^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Facet filters
    if (input.facetValueIds && input.facetValueIds.length > 0) {
      const operator = input.facetValueOperator === 'AND' ? 'must' : 'should';
      filter.push({
        bool: {
          [operator]: input.facetValueIds.map(id => ({
            term: { facetValueIds: id },
          })),
        },
      });
    }

    // Collection filter
    if (input.collectionId) {
      filter.push({
        term: { collectionIds: input.collectionId },
      });
    }

    // Default to match_all if no search term
    if (must.length === 0) {
      must.push({ match_all: {} });
    }

    return {
      bool: {
        must,
        filter,
      },
    };
  }

  /**
   * Build deterministic sort for search_after
   * CRITICAL: Must always include a unique tiebreaker
   *
   * ROOT CAUSE ANALYSIS: 2025-10-08
   * - Vendure variant index doesn't have createdAt field
   * - _id fielddata is disabled in ES 9.x (requires expensive fielddata)
   * - sku is TEXT field (not KEYWORD) - cannot sort without fielddata
   * - productVariantId is KEYWORD field and unique per variant ✅
   */
  private buildSort(sortInput?: CursorSearchInput['sort']): any[] {
    const sort: any[] = [];

    if (sortInput) {
      if (sortInput.name) {
        sort.push({ 'productName.keyword': { order: sortInput.name.toLowerCase() } });
      }
      if (sortInput.price) {
        sort.push({ priceWithTax: { order: sortInput.price.toLowerCase() } });
      }
    }

    // Deterministic sorting tiebreakers (both KEYWORD fields)
    if (!sort.some((s: any) => s.productId)) {
      sort.push({ productId: { order: 'asc' } });
    }
    sort.push({ productVariantId: { order: 'asc' } }); // FIX: Use productVariantId (keyword) instead of sku (text)

    return sort;
  }

  /**
   * Encode search_after values as base64 cursor
   */
  private encodeCursor(searchAfter: SearchAfterValues): string {
    return Buffer.from(JSON.stringify(searchAfter)).toString('base64');
  }

  /**
   * Decode base64 cursor to search_after values
   */
  private decodeCursor(cursor: string): SearchAfterValues {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }
}
