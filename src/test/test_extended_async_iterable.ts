import { asyncIter, ExtendedAsyncIterable } from "../";

import "should";
import "source-map-support/register";

const delay = (msec: number) => new Promise<void>(resolve => setTimeout(resolve, msec));

async function* ten() {
  for (let i = 0; i < 10; i++) yield i;
}

async function* slowTen() {
  for (let i = 0; i < 10; i++) {
    await delay(2);
    yield i;
  }
}

async function* slowerTen() {
  for (let i = 0; i < 10; i++) {
    await delay(10);
    yield i;
  }
}

async function* doubles(n: number) {
  yield n;
  await delay(1);
  yield n * 2;
}

describe("ExtendedAsyncIterable", () => {
  it("map", async () => {
    let rv: number[] = [];
    for await (const n of asyncIter(ten()).map(n => n * 2)) rv.push(n);
    rv.should.eql([ 0, 2, 4, 6, 8, 10, 12, 14, 16, 18 ]);

    rv = [];
    for await (const n of asyncIter(slowTen()).map(n => n * 2)) rv.push(n);
    rv.should.eql([ 0, 2, 4, 6, 8, 10, 12, 14, 16, 18 ]);
  });

  it("flatMap", async () => {
    let rv: number[] = [];
    for await (const n of asyncIter(ten()).flatMap(doubles)) rv.push(n);
    rv.should.eql([ 0, 0, 1, 2, 2, 4, 3, 6, 4, 8, 5, 10, 6, 12, 7, 14, 8, 16, 9, 18 ]);

    rv = [];
    for await (const n of asyncIter(slowTen()).flatMap(doubles)) rv.push(n);
    rv.should.eql([ 0, 0, 1, 2, 2, 4, 3, 6, 4, 8, 5, 10, 6, 12, 7, 14, 8, 16, 9, 18 ]);
  });

  it("filter", async () => {
    let rv: number[] = [];
    for await (const n of asyncIter(ten()).filter(n => n % 2 == 0)) rv.push(n);
    rv.should.eql([ 0, 2, 4, 6, 8 ]);

    rv = [];
    for await (const n of asyncIter(slowTen()).filter(n => n % 2 == 0)) rv.push(n);
    rv.should.eql([ 0, 2, 4, 6, 8 ]);
  })

  it("filterMap", async () => {
    let rv: number[] = [];
    for await (const n of asyncIter(ten()).filterMap(n => n % 2 == 0 ? n * 2 : undefined)) rv.push(n);
    rv.should.eql([ 0, 4, 8, 12, 16 ]);

    rv = [];
    for await (const n of asyncIter(slowTen()).filterMap(n => n % 2 == 0 ? n * 2 : undefined)) rv.push(n);
    rv.should.eql([ 0, 4, 8, 12, 16 ]);
  })

  it("find", async () => {
    ((await asyncIter(ten()).find(n => n == 4)) || 0).should.eql(4);
    ((await asyncIter(slowTen()).find(n => n == 4)) || 0).should.eql(4);
    ((await asyncIter(ten()).find(n => n > 14)) || 0).should.eql(0);
    ((await asyncIter(slowTen()).find(n => n > 14)) || 0).should.eql(0);
  });

  it("collect", async () => {
    (await asyncIter(ten()).collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
    (await asyncIter(slowTen()).collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
  });

  it("chain", async () => {
    (await asyncIter(ten()).chain(asyncIter(ten())).collect()).should.eql([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    ]);

    (await asyncIter(slowTen()).chain(asyncIter(slowTen())).collect()).should.eql([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    ]);
  });

  it("zip", async () => {
    (await asyncIter(ten()).take(4).zip(asyncIter(ten()).drop(1).take(5)).collect()).should.eql(
      [ [ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 3, 4 ] ]
    );

    (await asyncIter(slowTen()).take(5).zip(asyncIter(slowTen()).drop(1).take(4)).collect()).should.eql(
      [ [ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 3, 4 ] ]
    );
  });

  it("enumerate", async () => {
    (await asyncIter(ten()).map(n => n + 5).enumerate().collect()).should.eql(
      [ [ 0, 5 ], [ 1, 6 ], [ 2, 7 ], [ 3, 8 ], [ 4, 9 ], [ 5, 10 ], [ 6, 11 ], [ 7, 12 ], [ 8, 13 ], [ 9, 14 ] ]
    );

    (await asyncIter(slowTen()).map(n => n + 5).enumerate().collect()).should.eql(
      [ [ 0, 5 ], [ 1, 6 ], [ 2, 7 ], [ 3, 8 ], [ 4, 9 ], [ 5, 10 ], [ 6, 11 ], [ 7, 12 ], [ 8, 13 ], [ 9, 14 ] ]
    );
  });

  it("splitWhen", async () => {
    const [ iter1, iter2 ] = asyncIter(ten()).splitWhen(n => n >= 6);
    (await iter1.collect()).should.eql([ 0, 1, 2, 3, 4, 5 ]);
    (await iter2.collect()).should.eql([ 6, 7, 8, 9 ]);

    const [ iter3, iter4 ] = asyncIter(ten()).splitWhen(n => n >= 12);
    (await iter3.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
    (await iter4.collect()).should.eql([]);

    const [ iter5, iter6 ] = asyncIter(ten()).splitWhen(n => n < 100);
    (await iter5.collect()).should.eql([]);
    (await iter6.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);

    const [ iter7, iter8 ] = asyncIter(slowTen()).splitWhen(n => n >= 6);
    (await iter7.collect()).should.eql([ 0, 1, 2, 3, 4, 5 ]);
    (await iter8.collect()).should.eql([ 6, 7, 8, 9 ]);

    const [ iter9, iterA ] = asyncIter(slowTen()).splitWhen(n => n >= 12);
    (await iter9.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
    (await iterA.collect()).should.eql([]);

    const [ iterB, iterC ] = asyncIter(slowTen()).splitWhen(n => n < 100);
    (await iterB.collect()).should.eql([]);
    (await iterC.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
  });

  it("tee", async () => {
    const [ a, b ] = asyncIter(ten()).tee();
    (await a.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
    (await b.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);

    const [ c, d ] = asyncIter(slowTen()).tee();
    (await d.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
    (await c.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);

    const [ e, f ] = asyncIter(slowTen()).tee();
    (await e.take(3).collect()).should.eql([ 0, 1, 2 ]);
    (await f.collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
  });

  it("takeWhile", async () => {
    (await asyncIter(ten()).takeWhile(n => n <= 5).collect()).should.eql([ 0, 1, 2, 3, 4, 5 ]);
    (await asyncIter(slowTen()).takeWhile(n => n <= 5).collect()).should.eql([ 0, 1, 2, 3, 4, 5 ]);
  });

  it("take", async () => {
    (await asyncIter(ten()).take(4).collect()).should.eql([ 0, 1, 2, 3 ]);
    (await asyncIter(slowTen()).take(4).collect()).should.eql([ 0, 1, 2, 3 ]);
  });

  it("takeFor", async () => {
    (await asyncIter(slowerTen()).takeFor(48).collect()).should.eql([ 0, 1, 2, 3 ]);
  })

  it("dropWhile", async () => {
    (await asyncIter(ten()).dropWhile(n => n <= 5).collect()).should.eql([ 6, 7, 8, 9 ]);
    (await asyncIter(slowTen()).dropWhile(n => n <= 5).collect()).should.eql([ 6, 7, 8, 9 ]);
  });

  it("drop", async () => {
    (await asyncIter(ten()).drop(4).collect()).should.eql([ 4, 5, 6, 7, 8, 9 ]);
    (await asyncIter(slowTen()).drop(4).collect()).should.eql([ 4, 5, 6, 7, 8, 9 ]);
  });

  it("string splitting demo", async () => {
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

    (await iter.flatMap(intoLines()).collect()).should.eql([ "hello", "sailor", "eof" ]);
  });

  it("alerting", async () => {
    const iter = asyncIter(ten()).alerting();
    let count = 0;
    await Promise.all([
      async () => {
        await iter.done;
        count.should.eql(10);
      },
      async () => {
        for (let i = 0; i < 10; i++) {
          await delay(10);
          count++;
          (await iter.next()).value.should.eql(i);
        }
        ((await iter.next()).done || false).should.eql(true);
      }
    ]);
  });
});
