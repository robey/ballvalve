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
    async function* iterable() {
      for await (const item of wrapped) yield f(item);
    }
    return new ExtendedAsyncIterable(iterable());
  }

  flatMap<B>(f: (item: A) => AsyncIterable<B>): ExtendedAsyncIterable<B> {
    const wrapped = this.wrapped;
    async function* iterable() {
      for await (const item of wrapped) yield* f(item);
    }
    return new ExtendedAsyncIterable(iterable());
  }

  async collect(): Promise<A[]> {
    const rv: A[] = [];
    for await (const x of this.wrapped) rv.push(x);
    return rv;
  }

  /*
   * Take the first N items from this iterable and return them. This will
   * "realize" the iterable into an iterator if it hasn't been already,
   * meaning that this iterable can no longer be iterated multiple times.
   */
  async take(n: number): Promise<A[]> {
    const iter = this[Symbol.asyncIterator]();
    const rv: A[] = [];
    while (true) {
      if (rv.length == n) break;
      const result = await iter.next();
      if (result.done) break;
      rv.push(result.value);
    }
    this.wrapped = new ExtendedAsyncIterable(AsyncIterableIterator.from(iter));
    return rv;
  }
}
