export class AsyncIterableIterator<A> implements AsyncIterable<A> {
  constructor(public iter: AsyncIterator<A>) {
    // pass
  }

  [Symbol.asyncIterator](): AsyncIterator<A> {
    return this.iter;
  }

  /*
   * convert an `AsyncIterator<A>` into an `AsyncIterable<A>` that always
   * returns the same iterator. this can be useful if an object can only be
   * iterated once because it's a transient source (like a nodejs stream).
   */
  static from<A>(iter: AsyncIterator<A>): AsyncIterable<A> {
    if ((iter as any)[Symbol.asyncIterator]) return iter as any as AsyncIterable<A>;
    return new AsyncIterableIterator(iter);
  }
}
