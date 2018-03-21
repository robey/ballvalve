// in case the ES8 engine doesn't have the AsyncIterator symbol yet.
(Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");

import { AsyncIterableIterator } from "./async_iterable_iterator";
import { ExtendedAsyncIterable } from "./extended_async_iterable";
import { PushAsyncIterator } from "./push_async_iterator";

export { AsyncIterableIterator, ExtendedAsyncIterable, PushAsyncIterator };

export function wrap<A>(iter: AsyncIterable<A>): ExtendedAsyncIterable<A> {
  return new ExtendedAsyncIterable(iter);
}
