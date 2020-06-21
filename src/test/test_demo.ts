import * as stream from "stream";
import { asyncIter, ByteReader } from "../";

import "should";
import "source-map-support/register";

describe("demo", () => {
  it("sum u32 ints from a binary stream", async () => {
    const s = stream.Readable.from([
      Buffer.from("0102030408", "hex"), Buffer.from("0706", "hex"), Buffer.from("05", "hex")
    ]);

    async function *into4(stream: AsyncIterable<Buffer>) {
      const reader = new ByteReader(stream);
      while (true) {
        const chunk = await reader.read(4);
        if (chunk == undefined) return;
        if (chunk.length < 4) throw new Error("partial frame");
        yield chunk;
      }
    }

    const sum = await asyncIter(into4(s)).map(buffer => buffer.readUInt32LE(0)).reduce((sum, n) => sum + n, 0);
    sum.should.eql(0x9090909);
  });
});
