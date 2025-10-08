/**
 * GraphQL Schema Extensions for Deep Pagination
 *
 * Extends the shop API with cursor-based search that scales infinitely
 */

import gql from 'graphql-tag';

export const shopApiExtensions = gql`
  input CursorSearchInput {
    term: String
    facetValueIds: [ID!]
    facetValueOperator: LogicalOperator
    collectionId: ID
    collectionSlug: String
    groupByProduct: Boolean
    take: Int
    cursor: String
    sort: SearchResultSortParameter
  }

  type CursorSearchResult {
    items: [SearchResult!]!
    totalItems: Int!
    hasMore: Boolean!
    nextCursor: String
    prevCursor: String
  }

  extend type Query {
    """
    Deep pagination search using Elasticsearch search_after cursors.
    No 10k limit. Scales to millions of products.

    Usage:
    1. First page: cursorSearch(input: { take: 100 })
    2. Next page: cursorSearch(input: { take: 100, cursor: "<nextCursor>" })
    3. Repeat until hasMore = false
    """
    cursorSearch(input: CursorSearchInput!): CursorSearchResult!
  }
`;
