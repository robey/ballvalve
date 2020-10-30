let counter = 0;

type Resolver<A> = (value: IteratorResult<A>) => void;
type Rejecter = (error: Error) => void;

/*
 * adapt a streaming source (like a nodejs stream) into an `AsyncIterable`,
 * so it can be used in `for await` expressions.
 *
 * you may use this class in two different modes:
 *   - pure push: call `push(item)` as each item arrives, and don't set a
 *     `pullNext` callback. incoming items are queued for the recipient.
 *   - demand-based: call `push()` with no argument when you think data is
 *     ready, and use `pullNext` to fetch the next item (or `undefined` if
 *     it was a false alarm and nothing is ready yet).
 *
 * this works by responding to `next()` with an unfulfilled promise. when you
 * call `push`, if an item is available, it's posted into that promise. if
 * not, it calls `pullNext` to see if an item is available that way.
 *
 * when the stream is finished, call `end()` to signal to the recipient that
 * the iterator is done. any queued items (from `push(item)`) will be
 * delivered first.
 *
 * on error, call `error(error)` to cause all current and future `next()`
 * calls to throw an exception.
 */
export class PushAsyncIterator<A> implements AsyncIterator<A>, AsyncIterable<A> {
  private eof = false;
  private pendingError?: Error;
  id = ++counter;

  // items pushed by `push`, queued up for listeners
  private pushed: A[] = [];

  // the spec says we have to allow a bunch of sequential `next()` calls
  // before any of them resolve, and we have to respond to them in order.
  private resolve: Array<Resolver<A>> = [];
  private reject: Array<Rejecter> = [];

  constructor(private pullNext?: () => (A | undefined)) {
    // pass
  }

  push(item?: A) {
    if (item !== undefined) this.pushed.push(item);
    this.wakeup();
  }

  end() {
    this.eof = true;
    this.wakeup();
  }

  error(error: Error) {
    this.pendingError = error;
    this.wakeup();
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  next(): Promise<IteratorResult<A>> {
    return new Promise((resolve, reject) => {
      this.resolve.push(resolve);
      this.reject.push(reject);
      this.wakeup();
    });
  }

  private wakeup() {
    while (this.resolve.length > 0) {
      // in order: hand out any old queued data, throw any pending error,
      // signal completion if `end()` was called, or try to pull a new item.
      if (this.pushed.length > 0) {
        const value = this.pushed.shift();
        if (value !== undefined) this.callResolve({ done: false, value });
      } else if (this.pendingError) {
        this.callReject(this.pendingError);
      } else if (this.eof) {
        this.callResolve({ done: true, value: undefined });
      } else {
        const value = this.pullNext?.();
        if (value === undefined) return;
        this.callResolve({ done: false, value });
      }
    }
  }

  private callResolve(value: IteratorResult<A>) {
    const resolve = this.resolve.shift();
    this.reject.shift();
    if (!resolve) throw new Error("invalid state");
    resolve(value);
  }

  private callReject(error: Error) {
    const reject = this.reject.shift();
    this.resolve.shift();
    if (!reject) throw new Error("invalid state");
    reject(error);
  }

  toString(): string {
    return `PushAsyncIterator[${this.id}](pending=${this.pushed.length}, wait=${this.resolve.length})`;
  }
}
