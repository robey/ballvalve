import * as stream from "stream";
import { StreamAsyncIterator } from "../";

import "should";
import "source-map-support/register";

describe("StreamAsyncIterator", () => {
  it("writes data and closes", async () => {
    let done = false;
    const fake = new stream.Readable({
      read(size) {
        if (!done) {
          fake.push(Buffer.from("hello"));
          done = true;
        } else {
          fake.push(null);
        }
      }
    });

    let worked = false;
    for await (const b of StreamAsyncIterator.from(fake)) {
      b.toString().should.eql("hello");
      worked = true;
    }
    worked.should.eql(true);
  });

  it("collects a stream of data", async () => {
    let data = [ "hello", " sail", "or" ];
    const fake = new stream.Readable({
      read(size) {
        if (data.length == 0) {
          fake.push(null);
          return;
        }
        fake.push(Buffer.from(data.shift() || ""));
      }
    });

    const iter = StreamAsyncIterator.from(fake)[Symbol.asyncIterator]();
    const rv = await Promise.all([ iter.next(), iter.next(), iter.next(), iter.next() ]);
    rv.map(item => item.done ? "" : item.value.toString()).join("").should.eql("hello sailor");
  });

  it("catches errors", async () => {
    const fake = new stream.Readable({
      read(size) {
        process.nextTick(() => this.emit('error', new Error("I am broken")));
      }
    });

    let caught: Error | undefined;
    const iter = StreamAsyncIterator.from(fake);
    try {
      for await (const b of iter) {
        // shouldn't get here. :(
        console.log(b);
        (3).should.eql(4);
      }
    } catch (error) {
      caught = error;
    }
    (caught !== undefined).should.eql(true);

    // the error should be persistent.
    try {
      (await iter[Symbol.asyncIterator]().next()).should.eql(true);
    } catch (error) {
      error.message.should.match(/broken/);
    }
  });

  it("handles pre-pushed data", async () => {
    const s = new stream.PassThrough();
    s.write(Buffer.from("hello!"));

    const iter = StreamAsyncIterator.from(s)[Symbol.asyncIterator]();
    const result = await iter.next();
    (result.done || false).should.eql(false);
    result.value.toString().should.eql("hello!");
  });

  it("buffer splicing demo", async () => {
    let data = [ "hello", " sail", "or" ];
    const fake = new stream.Readable({
      read(size) {
        if (data.length == 0) {
          fake.push(null);
          return;
        }
        setTimeout(() => fake.push(Buffer.from(data.shift() || "")), 10);
      }
    });

    async function* threes(buffer: Buffer) {
      while (buffer.length > 0) {
        yield buffer.slice(0, 3);
        buffer = buffer.slice(3);
      }
    }

    const iter = StreamAsyncIterator.from(fake).flatMap(threes);
    (await iter.map(b => b.toString()).collect()).should.eql([ "hel", "lo", " sa", "il", "or" ]);
  });
});
