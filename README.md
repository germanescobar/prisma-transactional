# Prisma Transactional Context

This package adds support for transactions across functions without having to explicitly pass them around (argument drilling).

Underneath, it uses the [AsyncLocalStorage](https://nodejs.org/api/async_context.html) to store the transaction and [Proxy object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to wrap the prisma client.

It also supports [**savepoints**](https://en.wikipedia.org/wiki/Savepoint) to mimic nested transactions in databases that support this feature (tested in PostgreSQL only for now). **Savepoints** are enable by default, see below on how to disable them.

## Installation

```
npm install @germanescobar/prisma-transactional
```

## Usage

```typescript
import { AsyncLocalStorage } from 'node:async_hooks'
import createPrismaTransactionalProxy from '@germanescobar/prisma-transactional'

// create the instance of AsyncLocalStorage, you may want to define and export this 
// from another file to reuse it across the code
const asyncLocalStorage = new AsyncLocalStorage();

const originalPrisma = new PrismaClient(...);
const prisma = createPrismaTransactionalProxy(originalPrisma, asyncLocalStorage);

// use prisma as you would normally do
async function executeTransfer() {
  prisma.$transaction(tx => {
    // but now you can call other functions inside the transaction
    await transfer('111', '222', 100);
  });
}

async function transfer(from, to, amount) {
  // all these queries will run inside the transaction created previously
  const fromAccount = await prisma.account.findUniqueOrThrow({ where: { id: from }});
  await prisma.account.update({ where: { id: from }, data: { balance: fromAccount.balance - amount } });

  const toAccount = await prisma.account.findUniqueOrThrow({ where: { id: to }});
  await prisma.account.update({ where: { id: to }, data: { balance: toAccount.balance + amount } });
}
```

To support savepoints ("nested transactions") use the `enableSavePoints` option:

```typescript
const prisma = createPrismaTransactionalProxy(originalPrisma, asyncLocalStorage, { enableSavePoints: true });
```