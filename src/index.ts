// in case the ES8 engine doesn't have the AsyncIterator symbol yet.
if (Symbol.asyncIterator === undefined) (Symbol as any).asyncIterator = Symbol.for("Symbol.asyncIterator");

export { ExtendedAsyncIterable } from "./extended_async_iterable";
export { asyncIter } from "./extended_async_iterable";
export { PushAsyncIterator } from "./push_async_iterator";
export { ByteReader, byteReader } from "./byte_reader";
export { StreamAsyncIterator } from "./stream_async_iterator";
