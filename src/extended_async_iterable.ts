import { Gate } from "./gate";

let counter = 0;

/*
 * wrapper for AsyncIterable that has basic functional operations on it.
 */
export class ExtendedAsyncIterable<A> implements AsyncIterable<A>, AsyncIterator<A> {
  id = ++counter;
  getDebugName: () => string = () => this.wrapped.toString();
  cachedIterator?: AsyncIterator<A>;

  constructor(public wrapped: AsyncIterable<A>) {
    // pass
  }

  [Symbol.asyncIterator](): AsyncIterator<A> {
    // if the underlying iterable is restartable, we should be too:
    this.cachedIterator = this.wrapped[Symbol.asyncIterator]();
    return this;
  }

  next(): Promise<IteratorResult<A>> {
    this.cachedIterator = this.cachedIterator ?? this.wrapped[Symbol.asyncIterator]();
    return this.cachedIterator.next();
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

  async find(f: (item: A) => boolean): Promise<A | undefined> {
    for await (const item of this.wrapped) { if (f(item)) return item; }
    return undefined;
  }

  async some(f: (item: A) => boolean): Promise<boolean> {
    return (await this.find(f)) !== undefined;
  }

  async every(f: (item: A) => boolean): Promise<boolean> {
    return (await this.find(x => !f(x))) === undefined;
  }

  async reduce<B>(f: (sum: B, item: A) => B, start: B): Promise<B> {
    let rv = start;
    for await (const x of this.wrapped) rv = f(rv, x);
    return rv;
  }

  async collect(): Promise<A[]> {
    return this.reduce((sum, x) => { sum.push(x); return sum; }, [] as A[]);
  }

  chain(iter: AsyncIterable<A>): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      for await (const item of wrapped) yield item;
      for await (const item of iter) yield item;
    }());
  }

  static chainAll<A>(iters: AsyncIterable<A>[]): ExtendedAsyncIterable<A> {
    return asyncIter(async function* () {
      for (const iter of iters) {
        for await (const item of iter) yield item;
      }
    }());
  }

  zip<B>(iter: AsyncIterable<B>): ExtendedAsyncIterable<[ A, B ]> {
    const iter1 = this.wrapped[Symbol.asyncIterator]();
    const iter2 = iter[Symbol.asyncIterator]();
    return asyncIter(async function* () {
      while (true) {
        const r1 = await iter1.next();
        const r2 = await iter2.next();
        if (r1.done || r2.done) return;
        yield [ r1.value, r2.value ] as [ A, B ];
      }
    }());
  }

  merge<B>(...iterables: AsyncIterable<B>[]): ExtendedAsyncIterable<A | B> {
    return ExtendedAsyncIterable.mergeAll<A | B>([ this, ...iterables ]);
  }

  static mergeAll<A>(iterables: AsyncIterable<A>[]): ExtendedAsyncIterable<A> {
    type Result = IteratorResult<A>;
    type Iter = AsyncIterator<A>;

    const iters = iterables.map(iter => iter[Symbol.asyncIterator]());
    const next = async (iter: Iter): Promise<[ Iter, Result ]> => [ iter, await iter.next() ];
    const queue = new Map<Iter, Promise<[ Iter, Result ]>>(iters.map(iter => [ iter, next(iter) ]));

    return asyncIter(async function* () {
      while (queue.size > 0) {
        const [ iter, result ] = await Promise.race(queue.values());
        if (result.done) {
          queue.delete(iter);
        } else {
          queue.set(iter, next(iter));
          yield result.value;
        }
      }
    }());
  }

  enumerate(): ExtendedAsyncIterable<[ number, A ]> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      let i = 0;
      for await (const item of wrapped) {
        yield [ i, item ] as [ number, A ];
        i++;
      }
    }());
  }

  // return 2 iterators:
  //   - the first contains items as long as f(item) is false
  //   - the second contains the first item where f(item) is true, and all
  //     remaining items after that
  splitWhen(f: (item: A) => boolean): [ ExtendedAsyncIterable<A>, ExtendedAsyncIterable<A> ] {
    const iter = this.wrapped[Symbol.asyncIterator]();
    let unblock: (item: A | undefined) => void;
    const blocked = new Promise<A | undefined>(resolve => {
      unblock = resolve;
    });

    async function* iter1() {
      while (true) {
        const r = await iter.next();
        if (r.done) break;
        if (f(r.value)) {
          unblock(r.value);
          return;
        }
        yield r.value;
      }
      unblock(undefined);
    }

    async function* iter2() {
      const item = await blocked;
      if (item === undefined) return;
      yield item;
      while (true) {
        const r = await iter.next();
        if (r.done) return;
        yield r.value;
      }
    }

    return [ asyncIter(iter1()), asyncIter(iter2()) ];
  }

  tee(count: number = 2): ExtendedAsyncIterable<A>[] {
    const iter = this.wrapped[Symbol.asyncIterator]();
    const queues: IteratorResult<A>[][] = [...Array(count).keys()].map(i => []);
    const gate = new Gate(async () => {
      const r = await iter.next();
      for (const q of queues) q.push(r);
    });

    return queues.map(q => asyncIterFromQ(q, () => gate.wait()));
  }

  partition(f: (item: A) => boolean): [ ExtendedAsyncIterable<A>, ExtendedAsyncIterable<A> ] {
    const iter = this.wrapped[Symbol.asyncIterator]();
    const queues: [ IteratorResult<A>[], IteratorResult<A>[] ] = [ [], [] ];
    const gate = new Gate(async () => {
      const r = await iter.next();
      if (r.done) {
        queues[0].push(r);
        queues[1].push(r);
      } else {
        queues[f(r.value) ? 0 : 1].push(r);
      }
    });

    return [ asyncIterFromQ(queues[0], () => gate.wait()), asyncIterFromQ(queues[1], () => gate.wait()) ];
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

  dropWhile(f: (item: A) => boolean): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      let dropping = true;
      for await (const item of wrapped) {
        if (dropping && f(item)) continue;
        dropping = false;
        yield item;
      }
    }());
  }

  drop(n: number): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      let remaining = n;
      for await (const item of wrapped) {
        if (remaining > 0) {
          remaining--;
        } else {
          yield item;
        }
      }
    }());
  }

  after(f: () => Promise<void>): ExtendedAsyncIterable<A> {
    const wrapped = this.wrapped;
    return asyncIter(async function* () {
      for await (const item of wrapped) yield item;
      await f();
    }(), () => `after(${this})`);
  }

  withPromiseAfter(): [ ExtendedAsyncIterable<A>, Promise<void> ] {
    let resolve: () => void = () => 0;
    const done = new Promise<void>(r => {
      resolve = r;
    });
    return [ this.after(async () => resolve()), done ];
  }

  toString(): string {
    return `ExtendedAsyncIterable[${this.id}](${this.getDebugName()})`;
  }
}


// small wrapper to allow an iterator to be iterable.
class AsyncIterableIterator<A> implements AsyncIterable<A> {
  constructor(public __iter: AsyncIterator<A>) {}
  [Symbol.asyncIterator](): AsyncIterator<A> { return this.__iter; }
  toString(): string { return this.__iter.toString(); }
}


export type VaguelyIterable<A> = AsyncIterable<A> | AsyncIterator<A> | Iterable<A>;


/*
 * Turn an `AsyncIterable` or `AsyncIterator` into an `ExtendedAsyncIterable`
 * that has functional methods on it. Will try to add as few wrappers as
 * possible, and will pass existing `ExtendedAsyncIterable`s through unharmed.
 */
export function asyncIter<A>(iter: VaguelyIterable<A>, getDebugName?: () => string): ExtendedAsyncIterable<A> {
  // already ExtendedAsyncIterable?
  if (iter instanceof ExtendedAsyncIterable) {
    if (getDebugName) iter.getDebugName = getDebugName;
    return iter;
  }

  // AsyncIterable?
  if ((iter as any)[Symbol.asyncIterator]) {
    const i = new ExtendedAsyncIterable(iter as AsyncIterable<A>);
    if (getDebugName) i.getDebugName = getDebugName;
    return i;
  }

  // Iterable?
  if ((iter as any)[Symbol.iterator]) {
    return asyncIter(async function* () {
      for (const item of (iter as Iterable<A>)) yield item;
    }(), getDebugName || (() => cheapInspect(iter)));
  }

  // AsyncIterator
  const i = new ExtendedAsyncIterable(new AsyncIterableIterator(iter as AsyncIterator<A>));
  if (getDebugName) i.getDebugName = getDebugName;
  return i;
}

function cheapInspect(x: any): string {
  if (x["inspect"]) return x["inspect"]();

  if (x[Symbol.iterator]) {
    // it's an Iterable
    const iter = x as Iterable<any>;

    if (Array.isArray(iter)) {
      const a = iter as Array<any>;
      if (a.length == 0) return "[]";
      return "[ " + a.map(cheapInspect).join(", ") + " ]";
    }
    return "Iterable(...)";
  }

  return x.constructor.name + "(...)";
}

// factored out from tee & partition: given a queue of saved-up items, and
// a function that waits for more to be available, generate an asyncIter.
function asyncIterFromQ<A>(q: IteratorResult<A>[], next: () => Promise<void>): ExtendedAsyncIterable<A> {
  return asyncIter(async function* () {
    while (true) {
      let result = q.shift();
      if (result === undefined) {
        await next();
      } else {
        if (result.done) return;
        yield result.value;
      }
    }
  }());
}
