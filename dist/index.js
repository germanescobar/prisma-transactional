"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => createPrismaProxy
});
module.exports = __toCommonJS(src_exports);
function createPrismaProxy(client, asyncLocalStorage, options = { enableSavepoints: true }) {
  const createNestedTransaction = createNestedTransactionHandler(client, options.enableSavepoints);
  const proxy = new Proxy(client, {
    /**
     * Intercepts access to all properties of the PrismaClient instance. If there's a transaction 
     * in the asyncLocalStorage, it will use it, otherwise it will use the original PrismaClient instance.
     * 
     * If the property accessed is $transaction, it will create the transaction and add it to the asyncLocalStorage.
     */
    get(target, prop) {
      var _a;
      const tx = (_a = asyncLocalStorage.getStore()) == null ? void 0 : _a.tx;
      if (prop === "$transaction") {
        if (!tx) {
          return createTransactionHandler(asyncLocalStorage, target, prop);
        } else if (options.enableSavepoints) {
          return createNestedTransaction;
        }
      }
      return Reflect.get(tx != null ? tx : target, prop);
    }
  });
  return proxy;
}
function createTransactionHandler(asyncLocalStorage, target, prop) {
  const $transaction = Reflect.get(target, prop);
  return function(arg) {
    return __async(this, null, function* () {
      console.log(typeof arg);
      if (Array.isArray(arg)) {
        return $transaction.call(target, arg);
      } else {
        return yield $transaction.call(target, (tx) => __async(this, null, function* () {
          return yield asyncLocalStorage.run({ tx }, () => {
            return arg(tx);
          });
        }));
      }
    });
  };
}
function createNestedTransactionHandler(parentTxClient, enableSavepoints) {
  let seq = 1;
  const createNestedTransaction = (arg) => __async(this, null, function* () {
    const savePointId = `test_${seq++}`;
    if (enableSavepoints) {
      yield parentTxClient.$executeRawUnsafe(`SAVEPOINT ${savePointId};`);
    }
    if (Array.isArray(arg)) {
      try {
        const results = [];
        for (const prismaPromise of arg) {
          const result = yield prismaPromise;
          results.push(result);
        }
        if (enableSavepoints) {
          yield parentTxClient.$executeRawUnsafe(`RELEASE SAVEPOINT ${savePointId};`);
        }
        return results;
      } catch (err) {
        if (enableSavepoints) {
          yield parentTxClient.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savePointId};`);
        }
        throw err;
      }
    } else {
      try {
        const result = yield arg(parentTxClient);
        if (enableSavepoints) {
          yield parentTxClient.$executeRawUnsafe(`RELEASE SAVEPOINT ${savePointId};`);
        }
        return result;
      } catch (err) {
        if (enableSavepoints) {
          yield parentTxClient.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savePointId};`);
        }
        throw err;
      }
    }
  });
  return createNestedTransaction;
}
//# sourceMappingURL=index.js.map