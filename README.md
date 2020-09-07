# ballvalve

This is a collection of helpers for creating and using the ES 2018 `AsyncIterable` type. It includes all the usual functional methods (`map`, `reduce`, `collect`, and so on), as well as adapters for building an `AsyncIterable` out of a push-based stream, and reading discrete bytes from an `AsyncIterator<Buffer>`.

For example, to transform a nodejs buffer stream into a series of 4-byte little-endian `u32` values, and sum them:

```javascript
import * as stream from "stream";
import { asyncIter, byteReader } from "ballvalve";

// chop a stream into 4-byte chunks
async function* into4(stream: AsyncIterable<Buffer>) {
  const reader = byteReader(stream);
  while (true) {
    const chunk = await reader.read(4);
    if (chunk === undefined) return;
    if (chunk.length < 4) throw new Error("partial frame");
    yield chunk;
  }
}

// generate a sample stream of 8 bytes, encoding 0x4030201 and 0x5060708
const s = stream.Readable.from([
  Buffer.from("0102030408", "hex"),
  Buffer.from("0706", "hex"),
  Buffer.from("05", "hex")
]);

// map each chunk into its u32 value, and sum them as we go.
const sum = await asyncIter(into4(s)).map(buffer => buffer.readUInt32LE(0)).reduce((sum, n) => sum + n, 0);
// 0x9090909
```

As another example, you can transform a nodejs stream into lines of text, split at linefeeds:

```javascript
async function* lines(stream: AsyncIterable<Buffer>) {
  const reader = byteReader(stream);
  while (true) {
    const line = await reader.readUntil(10);
    if (line === undefined) return;
    yield line.toString("utf-8");
  }
}

const s = stream.Readable.from([ "hell", "o\nsa", "ilor\nxyzzy\n" ].map(s => Buffer.from(s)));

for await (const line of asyncIter(lines(s))) {
  console.log(line.trim());
}
// "hello", "sailor", "xyzzy"
```

## Building

```sh
npm install && npm test
```

## API

### `asyncIter<A>(iter: AsyncIterable<A> | AsyncIterator<A> | Iterable<A>): ExtendedAsyncIterable<A>`

Ensure that an object is async-iterable, by wrapping it in an object with a `[Symbol.asyncIterator]` method if necessary, and then wrap it in a fancy object with functional methods:

  - `map<B>(f: (item: A) => (B | Promise<B>)): ExtendedAsyncIterable<B>`

    Transform items from one type to another, just like `map` on an array. The function may return a promise.

  - `flatMap<B>(f: (item: A) => AsyncIterable<B>): ExtendedAsyncIterable<B>`

    Transform each item into an async-iterator of a possibly different type, and chain them together, just like `flatMap` on an array.

  - `filter(f: (item: A) => boolean): ExtendedAsyncIterable<A>`

    Keep only the items where `f` returns true, just like `filter` on an array.

  - `filterMap<B>(f: (item: A) => B | undefined): ExtendedAsyncIterable<B>`

    Transform items from one type to another, discarding any new items that are `undefined`.

  - `find(f: (item: A) => boolean): Promise<A | undefined>`

    Return the first item where `f` returns true, or `undefined` if it never does. Stop reading from the iterator as soon as an item is found.

  - `some(f: (item: A) => boolean): Promise<boolean>`

    Return true if `f` ever returns true for an item, just like `some` on an array. Stop reading from the iterator as soon as an item is found. Other languages call this function `any`.

  - `every(f: (item: A) => boolean): Promise<boolean>`

    Return true if `f` returns true for every item until the iterator is exhausted, just like `every` on an array. Stop reading from the iterable as soon as any item "fails" the test. Other languages call this function `all`.

  - `reduce<B>(f: (sum: B, item: A) => B, start: B): Promise<B>`

    Starting with the value `start`, accumulate by calling `f` on each element with the running total so far. The return value from `f` will be the running total passed to `f` for the next item. The final return value from `f` is the final result of `reduce`. This behaves just like `reduce` on an array, except that the starting value is required.

  - `collect(): Promise<A[]>`

    Use `reduce` to collect all values into a single array. Return that array when the iterator is exhausted.

  - `chain(iter: AsyncIterable<A>): ExtendedAsyncIterable<A>`

    Return a new async-iterable which contains each item from this iterable first, and then each element from `iter`. `iter` is not even read until this iterator is exhausted.

  - `static chainAll<A>(iters: AsyncIterable<A>[]): ExtendedAsyncIterable<A>`

    Return a new async-iterable which contains items from each iterable, exhausting each one before moving to the next.

  - `zip<B>(iter: AsyncIterable<B>): ExtendedAsyncIterable<[ A, B ]>`

    Return a new async-iterable which pairs each item from this iterable with an incoming item from `iter`. Each item-pair is provided only when each of the iterators has provided its next item. When either of the iterators is exhausted, the new iterator ends too.

  - `merge<B>(...iter: AsyncIterable<B>[]): ExtendedAsyncIterable<A | B>`

    Return a new async-iterable which contains items from this iterable and each of `iter`, in the order that those items become available. The order of items may be unpredictable.

  - `static mergeAll<A>(iterables: AsyncIterable<A>[]): ExtendedAsyncIterable<A>`

    Return a new async-iterable which contains items from each of `iterables`, in the order that items become available. The order of the items may be unpredictable.

  - `enumerate(): ExtendedAsyncIterable<[ number, A ]>`

    Return a new async-iterable which pairs each item from this iterable with its index, starting from 0.

  - `splitWhen(f: (item: A) => boolean): [ ExtendedAsyncIterable<A>, ExtendedAsyncIterable<A> ]`

    Return two new iterables:
      - The first returns items as long as `f` returns false.
      - The second contains the first items where `f` returns true, and all items that follow it.

    This splits the iterable into two consecutive iterables at an arbitrary point, doing the opposite of `chain`.

  - `tee(count: number = 2): ExtendedAsyncIterable<A>[]`

    Return `count` new iterables, each of which generates the same items, using this iterable as a source. If any of the new iterables is left un-read, it will queue items into memory as the other iterables are used, so you may want to make sure that all of the new iterables have an active reader.

  - `partition(f: (item: A) => boolean): [ ExtendedAsyncIterable<A>, ExtendedAsyncIterable<A> ]`

    Split this iterable in two: the first provides items where `f` returns true; the second provides items where `f` returns false. Like `tee`, if either of the returned iterables isn't actively processed, it will build up a queue of items, so make sure both iterables have an active reader.

  - `takeWhile(f: (item: A) => boolean): ExtendedAsyncIterable<A>`

    Return a new iterable that provides items as long as `f` returns true. Once `f` returns false for any item, that item is dropped and the new iterable ends.

  - `take(n: number): Promise<A[]>`

    Return a new iterable that provides up to `n` items from this iterable, then ends.

  - `takeFor(msec: number): ExtendedAsyncIterable<A>`

    Return a new iterable that provides items from this iterable until `msec` milliseconds have passed, at which point it will abruptly end.

  - `takeUntil(deadline: number): ExtendedAsyncIterable<A>`

    Return a new iterable that provides items from this iterable until `Date.now()` is greater than or equal to `deadline`, at which point it will abruptly end.

  - `dropWhile(f: (item: A) => boolean): ExtendedAsyncIterable<A>`

    Return a new iterable that drops all items as long as `f` returns true. The first provided item will be the first where `f` returned false. Afterwards, all items are passed along.

  - `drop(n: number): ExtendedAsyncIterable<A>`

    Return a new iterable that drops the first `n` items, and provides any items after that.

  - `after(f: () => Promise<void>): ExtendedAsyncIterable<A>`

    Return a new iterable that calls `f` when it's exhausted, and waits for `f` to finish before ending.

  - `withPromiseAfter(): [ ExtendedAsyncIterable<A>, Promise<void> ]`

    Return a new iterable and a promise. The promise is fulfilled when the iterator is exhausted.

### `byteReader(wrapped: AsyncIterable<Buffer> | AsyncIterator<Buffer> | Iterable<Buffer>): ByteReader`

Wrap an `AsyncIterable<Buffer>` to provide byte-level read operations.

  - `read(size: number): Promise<Buffer | undefined>`

    Read `size` bytes, waiting for data to arrive if necessary. If the stream ends before enough data is received, it will return as much as it can. If the stream has already ended, it will return `undefined`.

  - `readUntilMatch(test: (buffer: Buffer) => number): Promise<Buffer | undefined>`

    Read and buffer data from this stream until a `test` returns an index indicating a successful match. If no match is found before the stream ends, it returns `undefined`.

    `test` is called with all currently buffered data, each time new data arrives. It should return -1 on an unsuccessful match. On success, it should return the index right after the end of the match (as if you were about to pass it to `slice`).

  - `readUntil(byte: number): Promise<Buffer | undefined>`

    Read and buffer data from this stream until a specific byte is seen. Once it's seen, all buffered data up to & including the requested byte is returned. If the byte is never seen before the stream ends, it returns `undefined`.

  - `unread(buffer: Buffer)`

    "unshift" a buffer back onto the head of the stream.

  - `remainder(): Buffer | undefined`

    Return all currently buffered data without waiting for more, and clear the buffers. If nothing is buffered, it returns `undefined`.

### `PushAsyncIterator<A>(pullNext?: () => (A | undefined))`

Adapt a streaming source into an `AsyncIterable`.

You may use this class in two different modes:

  - pure push: Call `push(item)` as each item arrives, and don't set a `pullNext` callback. Incoming items are queued for the recipient.
  - demand-based: Call `push()` with no argument when you think data is ready, and use `pullNext` to fetch the next item (or `undefined` if it was a false alarm and nothing is ready yet).

`StreamAsyncIterator` is a good example of a demand-based iterator. A pure push iterator has no flow control, but may sometimes be necessary when adapting sources that have no flow control, like an "rxjs" stream.

This class works by responding to `next()` with an unfulfilled promise. When you call `push`, if an item is available, it's posted into that promise. If not, it calls `pullNext` to see if an item is available that way.

When the stream is finished, call `end()` to signal to the recipient that the iterator is done. Any queued items (from `push(item)`) will be delivered first.

On error, call `error(error)` to cause all current and future `next()` calls to throw an exception.

  - `push(item?: A)`
  - `end()`
  - `error(error: Error)`

### `StreamAsyncIterator(stream: stream.Readable, public size?: number)`

_(Note: Recent nodejs releases implement streams as `AsyncIterable`, so this class is now deprecated, and provided only as an example of how to use `StreamAsyncIterator`.)_

Wrap a nodejs `Readable` stream into an `AsyncIterator`. The iterable will place the stream into "pull" mode (paused) and emit `Buffer` objects on demand until it reaches the end of the stream, or the stream emits an error.

`size` is an optional parameter to pass to the stream's `read()` method, if you want to try to read chunks of a specific size.


## License

Apache 2 (open-source) license, included in `LICENSE.txt`.


## Authors

@robey - Robey Pointer <robeypointer@gmail.com>
