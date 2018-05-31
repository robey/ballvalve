# ballvalve

This is a collection of adapters for creating and using the ES 2018 `AsyncIterable` type.

For example, to wrap a nodejs stream into an `AsyncIterable`, and then pass it through a transform that ensures that no buffer is larger than 3 bytes:

```javascript
// turn a buffer into an AsyncIterator of tiny buffers:
async function* threes(buffer: Buffer) {
  while (buffer.length > 0) {
    yield buffer.slice(0, 3);
    buffer = buffer.slice(3);
  }
}

// turn a stream into an AsyncIterator, then flatMap it:
const iter = StreamAsyncIterator.from(myStream).flatMap(threes);
```

As another (not optimized) example, a `flatMap` operation can transform a stream of arbitratry-sized nodejs `Buffer` objects into lines of text, split at linefeeds:

```javascript
const iter = asyncIter([ "hell", "o\nsa", "ilor\neof\n" ].map(s => Buffer.from(s)));

const intoLines = () => {
  let saved: Buffer = Buffer.alloc(0);

  return async function* (data: Buffer) {
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] == "\n".charCodeAt(0)) {
        if (i > start) saved = Buffer.concat([ saved, data.slice(start, i) ]);
        yield saved.toString();
        saved = Buffer.alloc(0);
        start = i + 1;
      }
    }
    if (start < data.length) saved = Buffer.concat([ saved, data.slice(start) ]);
  };
}

await iter.flatMap(intoLines()).collect()
// => [ "hello", "sailor", "eof" ]
```

## Building

```sh
npm install && npm test
```

## API

- `asyncIter<A>(iter: AsyncIterable<A> | AsyncIterator<A>): ExtendedAsyncIterable<A>`

  Ensure that an object is iterable, by wrapping it in an object with a `[Symbol.asyncIterator]` method if necessary, and then wrap it in a fancy object with functional methods:

    - `map<B>(f: (item: A) => (B | Promise<B>)): ExtendedAsyncIterable<B>`
    - `flatMap<B>(f: (item: A) => AsyncIterable<B>): ExtendedAsyncIterable<B>`
    - `filter(f: (item: A) => boolean): ExtendedAsyncIterable<A>`
    - `filterMap<B>(f: (item: A) => B | undefined): ExtendedAsyncIterable<B>`
    - `find(f: (item: A) => boolean): Promise<A | undefined>`
    - `collect(): Promise<A[]>`
    - `chain(iter: AsyncIterable<A>): ExtendedAsyncIterable<A>`
    - `zip<B>(iter: AsyncIterable<B>): ExtendedAsyncIterable<[ A, B ]>`
    - `enumerate(): ExtendedAsyncIterable<[ number, A ]>`
    - `splitWhen(f: (item: A) => boolean): [ ExtendedAsyncIterable<A>, ExtendedAsyncIterable<A> ]`
    - `tee(count: number = 2): ExtendedAsyncIterable<A>[]`
    - `takeWhile(f: (item: A) => boolean): ExtendedAsyncIterable<A>`
    - `take(n: number): Promise<A[]>`
    - `takeFor(msec: number): ExtendedAsyncIterable<A>`
    - `takeUntil(deadline: number): ExtendedAsyncIterable<A>`
    - `dropWhile(f: (item: A) => boolean): ExtendedAsyncIterable<A>`
    - `drop(n: number): ExtendedAsyncIterable<A>`
    - `alerting(): AlertingAsyncIterator<A>`

- `PushAsyncIterator<A>(pullNext?: () => (A | undefined))`

  Adapt a streaming source (like a nodejs stream) into an `AsyncIterable`.

  You may use this class in two different modes:
    - pure push: Call `push(item)` as each item arrives, and don't set a `pullNext` callback. Incoming items are queued for the recipient.
    - demand-based: Call `push()` with no argument when you think data is ready, and use `pullNext` to fetch the next item (or `undefined` if it was a false alarm and nothing is ready yet).

  `StreamAsyncIterator` is a good example of a demand-based iterator. A pure push iterator has no flow control, but may sometimes be necessary when adapting sources that have no flow control, like an "rxjs" stream.

  This works by responding to `next()` with an unfulfilled promise. When you call `push`, if an item is available, it's posted into that promise. If not, it calls `pullNext` to see if an item is available that way.

  When the stream is finished, call `end()` to signal to the recipient that the iterator is done. Any queued items (from `push(item)`) will be delivered first.

  On error, call `error(error)` to cause all current and future `next()` calls to throw an exception.

    - `push(item?: A)`
    - `end()`
    - `error(error: Error)`

- `StreamAsyncIterator(stream: stream.Readable, public size?: number)`

  Wrap a nodejs `Readable` stream into an `AsyncIterator`. The iterable will place the stream into "pull" mode (paused) and emit `Buffer` objects on demand until it reaches the end of the stream, or the stream emits an error.

  `size` is an optional parameter to pass to the stream's `read()` method, if you want to try to read chunks of a specific size.

- `AlertingAsyncIterator`

  Wrap an `AsyncIterable` in an object that is still an `AsyncIterable`, but only iterates once, and has a `done` field:

    - `done: Promise<void>`

  This promise will resolve once the iterator has finished providing all its elements, and its `next()` method returned `done = true`.


## License

Apache 2 (open-source) license, included in `LICENSE.txt`.


## Authors

@robey - Robey Pointer <robeypointer@gmail.com>
