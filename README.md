# Vendure Deep Pagination Plugin

> Infinite product pagination using Elasticsearch `search_after` cursors. Bypass the 10k limit.

[![npm version](https://img.shields.io/npm/v/@gbros/vendure-plugin-deep-pagination)](https://www.npmjs.com/package/@gbros/vendure-plugin-deep-pagination)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

## The Problem

Elasticsearch limits offset-based pagination to 10,000 documents. For e-commerce stores with large catalogs:

- Users cannot browse beyond page 834 (12 products/page)
- Performance degrades linearly with page depth
- SEO suffers from incomplete product indexing

## The Solution

This plugin uses Elasticsearch's `search_after` API for cursor-based pagination:

- **No limits** - Navigate through millions of products
- **O(1) performance** - Constant speed at any page depth
- **Drop-in replacement** - Extends Vendure's GraphQL API

## Installation

```bash
npm install @gbros/vendure-plugin-deep-pagination
```

## Quick Start

### 1. Register Plugin

```typescript
// vendure-config.ts
import { DeepPaginationPlugin } from '@gbros/vendure-plugin-deep-pagination';

export const config: VendureConfig = {
  plugins: [
    // ... other plugins
    DeepPaginationPlugin,
  ],
};
```

### 2. Query Products

```graphql
query GetProducts($cursor: String) {
  cursorSearch(input: { take: 12, cursor: $cursor }) {
    items {
      productId
      productName
      slug
      priceWithTax {
        ... on SinglePrice { value }
        ... on PriceRange { min max }
      }
    }
    totalItems
    hasMore
    nextCursor
  }
}
```

### 3. Navigate Pages

```typescript
// First page
const page1 = await client.request(GET_PRODUCTS, {});

// Next page
const page2 = await client.request(GET_PRODUCTS, {
  cursor: page1.cursorSearch.nextCursor
});
```

## API Reference

### Input

| Field | Type | Description |
|-------|------|-------------|
| `term` | `string?` | Full-text search query |
| `facetValueIds` | `string[]?` | Filter by facet values |
| `facetValueOperator` | `'AND' \| 'OR'?` | Facet filter logic (default: `OR`) |
| `collectionId` | `string?` | Filter by collection ID |
| `collectionSlug` | `string?` | Filter by collection slug |
| `groupByProduct` | `boolean?` | Group variants by product |
| `take` | `number?` | Results per page (default: 100, max: 1000) |
| `cursor` | `string?` | Opaque pagination cursor |
| `sort` | `object?` | Sort options (see below) |

#### Sort Options

```typescript
{
  name?: 'ASC' | 'DESC';
  price?: 'ASC' | 'DESC';
}
```

### Output

| Field | Type | Description |
|-------|------|-------------|
| `items` | `SearchResult[]` | Products matching query |
| `totalItems` | `number` | Total result count |
| `hasMore` | `boolean` | More pages available |
| `nextCursor` | `string?` | Cursor for next page |

## How It Works

### Cursor Pagination

Traditional offset pagination (`skip` + `take`) becomes slow at high offsets because Elasticsearch must scan and discard all previous results.

Cursor pagination uses `search_after` to resume from the last result's sort values:

```
Page 1: [A, B, C] -> cursor: "C's sort values"
Page 2: search_after "C's values" -> [D, E, F]
```

### Deterministic Sorting

`search_after` requires stable sort order. We use:

1. User-specified field (name, price, etc.)
2. `productId` (keyword field)
3. `productVariantId` (keyword field)

This ensures consistent ordering even when products share the same name/price.

### Why Keyword Fields?

Elasticsearch 9.x disables `fielddata` by default. We use keyword fields for sorting because:

- Keyword fields use `doc_values` (disk-based, efficient)
- Text fields require `fielddata` (memory-intensive, disabled)

## Limitations

### Forward-Only Navigation

Cursor pagination is forward-only. You can:

- Go to next page (use `nextCursor`)
- Go to first page (omit `cursor`)
- Jump to arbitrary pages (not supported)

**Solution**: Maintain a cursor stack in your frontend:

```typescript
const [cursors, setCursors] = useState<string[]>([]);

// Forward
const goNext = () => {
  setCursors([...cursors, nextCursor]);
  fetchPage(nextCursor);
};

// Back
const goPrev = () => {
  const newCursors = cursors.slice(0, -1);
  setCursors(newCursors);
  fetchPage(newCursors[newCursors.length - 1]);
};
```

### No Total Page Count

You receive `totalItems` but not total pages. Display pagination as:

```typescript
const estimatedPages = Math.ceil(totalItems / take);
// Show: "Page 5 of ~1,320"
```

## Performance

| Method | Page 1 | Page 100 | Page 1000 |
|--------|--------|----------|-----------|
| Offset | 50ms | 200ms | 1000ms |
| Cursor | 50ms | 50ms | 50ms |

Cursor pagination maintains constant performance regardless of page depth.

## Requirements

- Vendure >= 3.0.0
- Elasticsearch >= 8.0.0
- Node.js >= 18

## Contributing

Contributions welcome! Please open an issue or PR.

### Development

```bash
git clone https://github.com/dylanmurzello/vendure-plugin-deep-pagination.git
cd vendure-plugin-deep-pagination
npm install
npm run build
```

## License

MIT - Dylan Murzello

## Acknowledgments

Built for production e-commerce at scale. Open-sourced for the Vendure community.

Inspired by Elasticsearch's [search_after documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/paginate-search-results.html#search-after).
