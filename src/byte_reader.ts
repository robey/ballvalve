import { asyncIter, VaguelyIterable } from "./extended_async_iterable";

let counter = 0;

/*
 * wrap an `AsyncIterable<Buffer>` so that it can provide byte-level read
 * operations.
 */
export class ByteReader implements AsyncIterator<Buffer> {
  iter: AsyncIterator<Buffer>;
  saved: Buffer[] = [];
  size = 0;
  ended = false;

  // track how many bytes were read
  bytesRead = 0;

  id = ++counter;
  getDebugName: () => string = () => this.iterable.toString();

  constructor(private iterable: AsyncIterable<Buffer>) {
    this.iter = iterable[Symbol.asyncIterator]();
  }

  next(): Promise<IteratorResult<Buffer>> {
    const buffer = this.remainder();
    if (buffer) return Promise.resolve({ value: buffer });
    return this.iter.next();
  }

  /*
   * read `size` bytes, waiting for data to arrive if necessary.
   * if the stream ends before enough data is received, it will return as
   * much as it can. if the stream has already ended, it will return
   * `undefined`.
   */
  async read(size: number): Promise<Buffer | undefined> {
    await this.fillTo(size);
    if (this.saved.length == 0) return undefined;
    return this.splitOff(size);
  }

  // returns true if anything was added.
  private async fill(): Promise<boolean> {
    if (this.ended) return false;
    const item = await this.iter.next();
    if (item.done) {
      this.ended = true;
      return false;
    }

    this.saved.push(item.value);
    this.size += item.value.length;
    return true;
  }

  private async fillTo(size: number): Promise<void> {
    while (this.size < size) {
      if (!await this.fill()) return;
    }
  }

  // this works even if size > this.size
  private splitOff(size: number): Buffer {
    const total = Buffer.concat(this.saved);
    const rv = total.slice(0, size);
    if (size >= total.length) {
      this.saved = [];
      this.size = 0;
    } else {
      this.saved = [ total.slice(size) ];
      this.size = this.saved[0].length;
    }
    this.bytesRead += rv.length;
    return rv;
  }

  private find(byte: number): number | undefined {
    let total = 0;
    for (let i = 0; i < this.saved.length; i++) {
      const n = this.saved[i].indexOf(byte);
      if (n >= 0) return total + n;
      total += this.saved[i].length;
    }
    return undefined;
  }

  /*
   * read and buffer data from this stream until a `test` returns an index
   * indicating a successful match. if no match is found before the stream
   * ends, it returns `undefined`.
   * `test` is called with all currently buffered data, each time new data
   * arrives. it should return -1 on an unsuccessful match. on success, it
   * should return the index right after the end of the match (as if you were
   * about to pass it to `slice`).
   */
  async readUntilMatch(test: (buffer: Buffer) => number): Promise<Buffer | undefined> {
    while (true) {
      const buffer = Buffer.concat(this.saved);
      const n = test(buffer);
      if (n >= 0) {
        this.saved = [ buffer.slice(n) ];
        this.size = this.saved[0].length;
        this.bytesRead += n;
        return buffer.slice(0, n);
      }

      if (!await this.fill()) return undefined;
    }
  }

  /*
   * read and buffer data from this stream until a specific byte is seen.
   * once it's seen, all buffered data up to & including the requested byte
   * is returned. if the byte is never seen before the stream ends, it
   * returns `undefined`.
   */
  async readUntil(byte: number): Promise<Buffer | undefined> {
    const n = this.find(byte);
    if (n !== undefined) return this.splitOff(n + 1);
    if (this.ended) return undefined;

    while (true) {
      const oldTotal = this.size;
      if (!await this.fill()) return undefined;
      const n = this.saved[this.saved.length - 1].indexOf(byte);
      if (n >= 0) return this.splitOff(oldTotal + n + 1);
    }
  }

  /*
   * "unshift" a buffer back onto the head of the stream.
   */
  unread(buffer: Buffer) {
    this.saved.unshift(buffer);
    this.size += buffer.length;
    this.bytesRead -= buffer.length;
  }

  /*
   * return all currently buffered data without waiting for more, and clear
   * the buffers. if nothing is buffered, it returns `undefined`.
   */
  remainder(): Buffer | undefined {
    if (this.size == 0) return undefined;
    const rv = Buffer.concat(this.saved);
    this.saved = [];
    this.size = 0;
    this.bytesRead += rv.length;
    return rv;
  }

  toString(): string {
    return `ByteReader[${this.id}](buffered=${this.size}, ${this.getDebugName()})`;
  }
}


/*
 * Turn any existing `Buffer` stream into a `ByteReader` with useful methods.
 */
export function byteReader(wrapped: VaguelyIterable<Buffer>, getDebugName?: () => string): ByteReader {
  if (wrapped instanceof ByteReader) return wrapped;
  const rv = new ByteReader(asyncIter(wrapped));
  if (getDebugName) rv.getDebugName = getDebugName;
  return rv;
}
