import * as stream from "stream";
import { byteReader } from "../byte_reader";

import "should";
import "source-map-support/register";

class FakeReadable extends stream.Readable {
  constructor(public data: Buffer[]) {
    super();
  }

  _read(size?: number): void {
    const buffer = this.data.shift();
    if (!buffer) {
      this.push(null);
    } else if (size === undefined || buffer.length <= size) {
      this.push(buffer);
    } else {
      this.data.unshift(buffer.slice(size));
      this.push(buffer.slice(0, size));
    }
  }
}

describe("ByteReader", () => {
  it("works on a nodejs stream", async () => {
    const s = byteReader(new FakeReadable([ "hello" ].map(s => Buffer.from(s))));
    const b1 = await s.read(10);
    (b1 === undefined).should.eql(false);
    b1?.toString().should.eql("hello");
    const b2 = await s.read(10);
    (b2 === undefined).should.eql(true);
  });

  it("buffers", async () => {
    const s = byteReader(new FakeReadable([ Buffer.from("hen"), Buffer.from("lo!") ]));
    const b1 = await s.read(5);
    (b1 === undefined).should.eql(false);
    b1?.toString().should.eql("henlo");
    const b2 = await s.read(10);
    (b2 === undefined).should.eql(false);
    b2?.toString().should.eql("!");
    const b3 = await s.read(10);
    (b3 === undefined).should.eql(true);
  });

  it("readUntil", async () => {
    const s = byteReader(new FakeReadable([ "hell", "o\nsa", "ilor\neof\n" ].map(s => Buffer.from(s))));
    const b1 = await s.readUntil(10);
    (b1 === undefined).should.eql(false);
    b1?.toString().should.eql("hello\n");
    const b2 = await s.readUntil(10);
    (b2 === undefined).should.eql(false);
    b2?.toString().should.eql("sailor\n");
    const b3 = await s.readUntil(10);
    (b3 === undefined).should.eql(false);
    b3?.toString().should.eql("eof\n");
    const b4 = await s.readUntil(10);
    (b4 === undefined).should.eql(true);
  });

  it("works on an async iterator", async () => {
    const s = byteReader([ Buffer.from("hello") ]);
    const b1 = await s.read(10);
    (b1 === undefined).should.eql(false);
    b1?.toString().should.eql("hello");
    const b2 = await s.read(10);
    (b2 === undefined).should.eql(true);
  });
});
