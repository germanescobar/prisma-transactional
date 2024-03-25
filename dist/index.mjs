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
export {
  createPrismaProxy as default
};
//# sourceMappingURL=index.mjs.map