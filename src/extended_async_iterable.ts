import { AsyncIterableIterator } from "./async_iterable_iterator";

/*
 * wrapper for AsyncIterable that has basic functional operations on it.
 */
export class ExtendedAsyncIterable<A> implements AsyncIterable<A> {
  constructor(public wrapped: AsyncIterable<A>) {
    // pass
  }

  [Symbol.asyncIterator](): AsyncIterator<A> {
    return this.wrapped[Symbol.asyncIterator]();
  }

  map<B>(f: (item: A) => (B | Promise<B>)): ExtendedAsyncIterable<B> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      for await (const item of wrapped) yield f(item);
    }());
  }

  flatMap<B>(f: (item: A) => AsyncIterable<B>): ExtendedAsyncIterable<B> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      for await (const item of wrapped) yield* f(item);
    }());
  }

  filter(f: (item: A) => boolean): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      for await (const item of wrapped) if (f(item)) yield item;
    }());
  }

  filterMap<B>(f: (item: A) => B | undefined): ExtendedAsyncIterable<B> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      for await (const item of wrapped) {
        const rv = f(item);
        if (rv !== undefined) yield rv;
      }
    }());
  }

  // reduce
  // some
  // every

  async collect(): Promise<A[]> {
    const rv: A[] = [];
    for await (const x of this.wrapped) rv.push(x);
    return rv;
  }

  chain(iter: AsyncIterable<A>): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* iterable() {
      for await (const item of wrapped) yield item;
      for await (const item of iter) yield item;
    }());
  }

  // zip
  // enumerate
  // partition

  takeWhile(f: (item: A) => boolean): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* iterable() {
      for await (const item of wrapped) {
        if (!f(item)) return;
        yield item;
      }
    }());
  }

  take(n: number): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* iterable() {
      let remaining = n;
      for await (const item of wrapped) {
        yield item;
        remaining--;
        if (remaining == 0) return;
      }
    }());
  }

  takeFor(msec: number): ExtendedAsyncIterable<A> {
    return this.takeUntil(Date.now() + msec);
  }

  takeUntil(deadline: number): ExtendedAsyncIterable<A> {
    const iter = this.wrapped[Symbol.asyncIterator]();
    return asyncIter(async function* iterable() {
      while (true) {
        const now = Date.now();
        if (now >= deadline) return;
        const nextPromise = iter.next();
        const result = await Promise.race([
          nextPromise,
          new Promise<void>(resolve => setTimeout(resolve, deadline - now)).then(() => undefined)
        ]);
        // ran out of time? throw it away. (js doesn't have cancel)
        if (result === undefined || result.done) return;
        yield result.value;
      }
    }());
  }

  // dropWhile
  // drop
  // dropFor
  // dropUntil
}

export function asyncIter<A>(iter: AsyncIterable<A>): ExtendedAsyncIterable<A> {
  return (iter instanceof ExtendedAsyncIterable) ? iter : new ExtendedAsyncIterable(iter);
}
