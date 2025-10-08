/**
 * Deep Pagination Plugin
 *
 * ENGINEERING DECISION: 2025-10-08
 * Proper infinite pagination using Elasticsearch search_after.
 * No arbitrary limits. Scales to millions of products.
 *
 * Why search_after over offset/skip:
 * - offset 10k+ = slow (ES has to sort and skip)
 * - search_after = constant time, uses last doc's sort values
 * - Deterministic sorting (createdAt + _id) ensures consistency
 */

import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Client } from '@elastic/elasticsearch';
import { shopApiExtensions } from './api-extensions';
import { DeepPaginationService } from './deep-pagination.service';
import { DeepPaginationResolver } from './deep-pagination.resolver';
import { ELASTICSEARCH_CLIENT } from './constants';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    DeepPaginationService,
    {
      provide: ELASTICSEARCH_CLIENT,
      useFactory: () => {
        // Create ES client (same config as ElasticsearchPlugin)
        return new Client({
          node: process.env.ELASTICSEARCH_HOST || 'http://10.116.0.3:9200',
        });
      },
    },
    {
      provide: 'ELASTICSEARCH_INDEX_PREFIX',
      useValue: process.env.ELASTICSEARCH_INDEX_PREFIX || 'gbros',
    },
  ],
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [DeepPaginationResolver],
  },
  compatibility: '^3.0.0',
})
export class DeepPaginationPlugin {}
