import { ExtendedAsyncIterable, wrap } from "../";

import "should";
import "source-map-support/register";

const delay = (msec: number) => new Promise<void>(resolve => setTimeout(resolve, msec));

async function* ten() {
  for (let i = 0; i < 10; i++) yield i;
}

async function* slowTen() {
  for (let i = 0; i < 10; i++) {
    await delay(1);
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
    for await (const n of wrap(ten()).map(n => n * 2)) rv.push(n);
    rv.should.eql([ 0, 2, 4, 6, 8, 10, 12, 14, 16, 18 ]);

    rv = [];
    for await (const n of wrap(slowTen()).map(n => n * 2)) rv.push(n);
    rv.should.eql([ 0, 2, 4, 6, 8, 10, 12, 14, 16, 18 ]);
  });

  it("flatMap", async () => {
    let rv: number[] = [];
    for await (const n of wrap(ten()).flatMap(doubles)) rv.push(n);
    rv.should.eql([ 0, 0, 1, 2, 2, 4, 3, 6, 4, 8, 5, 10, 6, 12, 7, 14, 8, 16, 9, 18 ]);

    rv = [];
    for await (const n of wrap(slowTen()).flatMap(doubles)) rv.push(n);
    rv.should.eql([ 0, 0, 1, 2, 2, 4, 3, 6, 4, 8, 5, 10, 6, 12, 7, 14, 8, 16, 9, 18 ]);
  });

  it("filter", async () => {
    let rv: number[] = [];
    for await (const n of wrap(ten()).filter(n => n % 2 == 0)) rv.push(n);
    rv.should.eql([ 0, 2, 4, 6, 8 ]);

    rv = [];
    for await (const n of wrap(slowTen()).filter(n => n % 2 == 0)) rv.push(n);
    rv.should.eql([ 0, 2, 4, 6, 8 ]);
  })

  it("collect", async () => {
    (await wrap(ten()).collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
    (await wrap(slowTen()).collect()).should.eql([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
  });

  it("take", async () => {
    let iter = wrap(ten());
    (await iter.take(4)).should.eql([ 0, 1, 2, 3 ]);
    (await iter.collect()).should.eql([ 4, 5, 6, 7, 8, 9 ]);

    iter = wrap(slowTen());
    (await iter.take(4)).should.eql([ 0, 1, 2, 3 ]);
    (await iter.collect()).should.eql([ 4, 5, 6, 7, 8, 9 ]);
  });
});
