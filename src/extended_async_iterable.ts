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
  // any
  // all

  async collect(): Promise<A[]> {
    const rv: A[] = [];
    for await (const x of this.wrapped) rv.push(x);
    return rv;
  }

  chain(iter: AsyncIterable<A>): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      for await (const item of wrapped) yield item;
      for await (const item of iter) yield item;
    }());
  }

  // zip
  // enumerate
  // partition

  tee(count: number = 2): ExtendedAsyncIterable<A>[] {
    const iter = this.wrapped[Symbol.asyncIterator]();
    const queued: IteratorResult<A>[][] = new Array(count);

    return [...Array(count).keys()].map(i => {
      queued[i] = [];
      return asyncIter(async function* () {
        while (true) {
          let result = queued[i].shift();
          if (result === undefined) {
            let r = await iter.next();
            queued.forEach(q => q.push(r));
            continue;
          }
          if (result.done) return;
          yield result.value;
        }
      }());
    });
  }

  takeWhile(f: (item: A) => boolean): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      for await (const item of wrapped) {
        if (!f(item)) return;
        yield item;
      }
    }());
  }

  take(n: number): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
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
    return asyncIter(async function* () {
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

// small wrapper to allow an iterator to be iterable.
class AsyncIterableIterator<A> implements AsyncIterable<A> {
  constructor(public __iter: AsyncIterator<A>) {}
  [Symbol.asyncIterator](): AsyncIterator<A> { return this.__iter; }
}

/*
 * Turn an `AsyncIterable` or `AsyncIterator` into an `ExtendedAsyncIterable`
 * that has functional methods on it. Will try to add as few wrappers as
 * possible, and will pass existing `ExtendedAsyncIterable`s through unharmed.
 */
export function asyncIter<A>(iter: AsyncIterable<A> | AsyncIterator<A>): ExtendedAsyncIterable<A> {
  if (iter instanceof ExtendedAsyncIterable) return iter;
  if ((iter as any)[Symbol.asyncIterator]) return new ExtendedAsyncIterable(iter as any as AsyncIterable<A>);
  return new ExtendedAsyncIterable(new AsyncIterableIterator(iter as any as AsyncIterator<A>));
}
