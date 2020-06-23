import * as stream from "stream";
import { asyncIter, byteReader } from "../";

import "should";
import "source-map-support/register";

describe("demo", () => {
  it("sum u32 ints from a binary stream", async () => {
    const s = stream.Readable.from([
      Buffer.from("0102030408", "hex"), Buffer.from("0706", "hex"), Buffer.from("05", "hex")
    ]);

    async function *into4(stream: AsyncIterable<Buffer>) {
      const reader = byteReader(stream);
      while (true) {
        const chunk = await reader.read(4);
        if (chunk === undefined) return;
        if (chunk.length < 4) throw new Error("partial frame");
        yield chunk;
      }
    }

    const sum = await asyncIter(into4(s)).map(buffer => buffer.readUInt32LE(0)).reduce((sum, n) => sum + n, 0);
    sum.should.eql(0x9090909);
  });

  it("splits lines", async () => {
    async function *lines(stream: AsyncIterable<Buffer>) {
      const reader = byteReader(stream);
      while (true) {
        const line = await reader.readUntil(10);
        if (line === undefined) return;
        yield line.toString("utf-8");
      }
    }

    const s = stream.Readable.from([ "hell", "o\nsa", "ilor\neof\n" ].map(s => Buffer.from(s)));
    (await asyncIter(lines(s)).collect()).map(s => s.trim()).should.eql([ "hello", "sailor", "eof" ]);
  });
});
