/**
 * Deep Pagination GraphQL Resolver
 *
 * Exposes cursorSearch query to shop API
 */

import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Allow, Permission } from '@vendure/core';
import { DeepPaginationService } from './deep-pagination.service';
import { CursorSearchInput } from './types';

@Resolver()
export class DeepPaginationResolver {
  constructor(private deepPaginationService: DeepPaginationService) {}

  @Query()
  @Allow(Permission.Public) // Public access for storefront
  async cursorSearch(
    @Ctx() ctx: RequestContext,
    @Args() args: { input: CursorSearchInput },
  ) {
    return this.deepPaginationService.cursorSearch(ctx, args.input);
  }
}
