let counter = 0;

// an AsyncIterator that resolves a `done` promise when the iterator is complete
export class AlertingAsyncIterator<A> implements AsyncIterator<A>, AsyncIterable<A> {
  done: Promise<void>;
  id = ++counter;

  private wrapped: AsyncIterator<A>;
  private resolve?: () => void;
  private reject?: (e: Error) => void;

  constructor(public stream: AsyncIterable<A>, public getDebugName: () => string) {
    this.wrapped = stream[Symbol.asyncIterator]();
    this.done = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  [Symbol.asyncIterator](): AsyncIterator<A> {
    return this;
  }

  async next(): Promise<IteratorResult<A>> {
    try {
      const rv = await this.wrapped.next();
      if (rv.done && this.resolve) this.resolve();
      return rv;
    } catch (error) {
      if (this.reject) this.reject(error);
      throw error;
    }
  }

  toString(): string {
    return `AlertingAsyncIterator[${this.id}](${this.getDebugName()})`;
  }
}
