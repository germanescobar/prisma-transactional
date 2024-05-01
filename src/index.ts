import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

export type Context = {
  tx: Partial<PrismaClient>
}

export type PrismaProxyOptions = {
  enableSavepoints: boolean
}

/**
 * Returns an proxy of PrismaClient that can be used to run transactions across functions.
 * 
 * @param client the Prisma Client instance that will be proxied
 * @param asyncLocalStorage the asyncLocalStorage instance that will be used to store the transaction
 * @param options
 *          enableSavePoints: if true (default), it will use SAVEPOINTS to support nested transactions.
 * @returns 
 */
export default function createPrismaProxy<T extends Context>(client: PrismaClient, asyncLocalStorage: AsyncLocalStorage<T>, options: PrismaProxyOptions = { enableSavepoints: true }) {
  const proxy = new Proxy(client, {
    /**
     * Intercepts access to all properties of the PrismaClient instance. If there's a transaction 
     * in the asyncLocalStorage, it will use it, otherwise it will use the original PrismaClient instance.
     * 
     * If the property accessed is $transaction, it will create the transaction and add it to the asyncLocalStorage.
     */
    get(target: PrismaClient, prop) {
      const tx = asyncLocalStorage.getStore()?.tx;
      if (prop === '$transaction') {
        if (!tx) {
          return createTransactionHandler(asyncLocalStorage, target, prop)
        } else if (options.enableSavepoints) {
          return createNestedTransactionHandler(tx as PrismaClient, options.enableSavepoints);
        }
      }
      return Reflect.get(tx ?? target, prop);
    },
  });

  return proxy;
}

/**
 * Returns the proxy of $transaction, which will create the transaction and store it in the asyncLocalStorage.
 * @param asyncLocalStorage 
 * @param target the original PrismaClient instance
 * @param prop this is always $transaction at this point
 * @returns a function that can be used in the same way as prisma.$transaction.
 */
function createTransactionHandler<T extends Context>(asyncLocalStorage: AsyncLocalStorage<T>, target: PrismaClient, prop: string) {
  // get the original $transaction function from the PrismaClient instance
  const $transaction = Reflect.get<PrismaClient, string>(target, prop);

  // return a modified version that stores the transaction in the asyncLocalStorage
  return async function(arg: (tx: PrismaClient) => Promise<any> | PromiseLike<unknown>[]) {
    if (Array.isArray(arg)) {
      // just delegate to the original $transaction
      return $transaction.call(target, arg);
    } else {
      return await $transaction.call(target, async (tx: PrismaClient) => {
        return await asyncLocalStorage.run({ tx } as T, () => {
          return arg(tx);
        });
      });
    }
  }
}

/**
 * Used to support nested transactions. Adapted from the jest-prisma project.
 */
function createNestedTransactionHandler(tx: PrismaClient, enableSavepoints: boolean) {
  let seq = 1;
  return async (arg: PromiseLike<unknown>[] | ((_: PrismaClient) => Promise<unknown>)) => {
    const savePointId = `test_${seq++}`;
    if (enableSavepoints) {
      await tx.$executeRawUnsafe(`SAVEPOINT ${savePointId};`);
    }

    try {
      if (Array.isArray(arg)) {
        const results = [] as unknown[];
        for (const prismaPromise of arg) {
          const result = await prismaPromise;
          results.push(result);
        }
        if (enableSavepoints) {
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savePointId};`);
        }
        return results;
      } else {
        const result = await arg(tx);
        if (enableSavepoints) {
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savePointId};`);
        }
        return result;
      }
    } catch (err) {
      if (enableSavepoints) {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savePointId};`);
      }
      throw err;
    }
  };
}