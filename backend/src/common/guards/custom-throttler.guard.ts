import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerLimitDetail } from "@nestjs/throttler";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);

    const retryAfterSeconds = throttlerLimitDetail.isBlocked
      ? throttlerLimitDetail.timeToBlockExpire
      : throttlerLimitDetail.timeToExpire;

    res.header("Retry-After", retryAfterSeconds.toString());
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
