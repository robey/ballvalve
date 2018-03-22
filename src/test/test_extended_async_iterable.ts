import { asyncIter, ExtendedAsyncIterable } from "../";

import "should";
import "source-map-support/register";

const delay = (msec: number) => new Promise<void>(resolve => setTimeout(resolve, msec));

async function* ten() {
  for (let i = 0; i < 10; i++) yield i;
}

async function* slowTen() {
  for (let i = 0; i < 10; i++) {
    await delay(4);
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

  it("takeWhile", async () => {
    (await asyncIter(ten()).takeWhile(n => n <= 5).collect()).should.eql([ 0, 1, 2, 3, 4, 5 ]);
    (await asyncIter(slowTen()).takeWhile(n => n <= 5).collect()).should.eql([ 0, 1, 2, 3, 4, 5 ]);
  });

  it("take", async () => {
    (await asyncIter(ten()).take(4).collect()).should.eql([ 0, 1, 2, 3 ]);
    (await asyncIter(slowTen()).take(4).collect()).should.eql([ 0, 1, 2, 3 ]);
  });

  it("takeFor", async () => {
    (await asyncIter(slowTen()).takeFor(20).collect()).should.eql([ 0, 1, 2, 3 ]);
  })
});
