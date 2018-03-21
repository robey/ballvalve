import { PushAsyncIterator, wrap } from "../";

import "should";
import "source-map-support/register";

describe("PushAsyncIterator", () => {
  it("writes data and closes", async () => {
    const iter = new PushAsyncIterator<number>();
    iter.push(4);
    iter.push(5);
    iter.end();

    (await wrap(iter).collect()).should.eql([ 4, 5 ]);
  });

  it("wakes up as data arrives", async () => {
    const iter = new PushAsyncIterator<number>();
    setTimeout(() => {
      iter.push(4);
      iter.push(5);
      iter.end();
    }, 10);

    (await wrap(iter).collect()).should.eql([ 4, 5 ]);
  });

  it("wakes up on a trickle", async () => {
    const iter = new PushAsyncIterator<number>();
    setTimeout(() => {
      iter.push(4);
    }, 10);
    setTimeout(() => {
      iter.push(5);
    }, 20);
    setTimeout(() => {
      iter.end();
    }, 30);

    (await wrap(iter).collect()).should.eql([ 4, 5 ]);
  });

  it("operates in pull mode", async () => {
    let waiting: number | undefined = undefined;
    const iter = new PushAsyncIterator(() => {
      const rv = waiting;
      waiting = undefined;
      return rv;
    });

    setTimeout(() => {
      waiting = 4;
      iter.push();
    }, 10);

    setTimeout(() => {
      iter.push();
    }, 20);

    setTimeout(() => {
      waiting = 5;
      iter.push();
    }, 30);

    setTimeout(() => {
      iter.end();
    }, 40);

    (await wrap(iter).collect()).should.eql([ 4, 5 ]);
  });

  it("catches errors", async () => {
    const iter = new PushAsyncIterator<number>();
    setTimeout(() => {
      iter.error(new Error("foo"));
    }, 10);

    let thrown = false;
    try {
      await wrap(iter).collect();
    } catch (error) {
      thrown = true;
    }
    thrown.should.eql(true);
  });
});
