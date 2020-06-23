import * as stream from "stream";
import { asyncIter, ExtendedAsyncIterable } from "./extended_async_iterable";
import { PushAsyncIterator } from "./push_async_iterator";

/*
 * wrap a node.js `Readable` stream into an ES 2018 `AsyncIterable`, of the
 * kind that can be used in `for await` expressions. the iterable will
 * place the stream into "pull" mode (paused) and emit `Buffer` objects on
 * demand until it reaches the end of the stream, or the stream emits an
 * error.
 *
 * `size` is an optional parameter to pass to the stream's `read()` method,
 * if you want to try to read chunks of a specific size.
 *
 * recent versions of node implement `AsyncIterable` on each stream
 * automatically, so this class isn't really necessary.
 */
export class StreamAsyncIterator extends PushAsyncIterator<Buffer> implements AsyncIterable<Buffer> {
  constructor(public stream: stream.Readable, public size?: number) {
    super(() => {
      const buffer = this.stream.read(this.size) as Buffer;
      return buffer == null ? undefined : buffer;
    });

    stream.pause();
    stream.on("readable", () => this.push());
    stream.on("error", error => this.error(error));
    stream.on("end", () => this.end());
    stream.on("close", () => this.end());

    // in case there's data already waiting, trigger a read() check:
    this.push();
  }

  static from(stream: stream.Readable, size?: number): ExtendedAsyncIterable<Buffer> {
    return asyncIter(new StreamAsyncIterator(stream, size));
  }
}
