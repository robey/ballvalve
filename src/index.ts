// in case the ES8 engine doesn't have the AsyncIterator symbol yet.
(Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");

import { ExtendedAsyncIterable } from "./extended_async_iterable";

export { ExtendedAsyncIterable };

export function wrap<A>(iter: AsyncIterable<A>): ExtendedAsyncIterable<A> {
  return new ExtendedAsyncIterable(iter);
}