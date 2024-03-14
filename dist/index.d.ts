import * as _prisma_client_runtime_library from '@prisma/client/runtime/library';
import * as _prisma_client from '.prisma/client';
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

type Context = {
    tx: Partial<PrismaClient>;
};
type PrismaProxyOptions = {
    enableSavePoints: boolean;
};
/**
 * Returns an proxy of PrismaClient that can be used to run transactions across functions.
 *
 * @param client the Prisma Client instance that will be proxied
 * @param asyncLocalStorage the asyncLocalStorage instance that will be used to store the transaction
 * @param options
 *          enableSavePoints: if true (default), it will use SAVEPOINTS to support nested transactions.
 * @returns
 */
declare function createPrismaProxy<T extends Context>(client: PrismaClient, asyncLocalStorage: AsyncLocalStorage<T>, options?: PrismaProxyOptions): PrismaClient<_prisma_client.Prisma.PrismaClientOptions, never, _prisma_client_runtime_library.DefaultArgs>;

export { type Context, type PrismaProxyOptions, createPrismaProxy as default };
