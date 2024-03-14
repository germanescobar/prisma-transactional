import { PrismaClient } from '@prisma/client';
import createPrismaProxy, { Context } from '../src/index';
import { expect, test } from 'vitest'
import { AsyncLocalStorage } from 'node:async_hooks';

test('transaction succeeds in a money transfer scenario', async () => {
  const asyncLocalStorage = new AsyncLocalStorage<Context>();
  const originalPrisma = new PrismaClient()
  const prisma = createPrismaProxy(originalPrisma, asyncLocalStorage);

  async function transfer(from: string, to: string, amount: number) {
    const fromAccount = await prisma.account.findUniqueOrThrow({ where: { id: from }})
    await prisma.account.update({ where: { id: from }, data: { balance: fromAccount.balance - amount } })

    const toAccount = await prisma.account.findUniqueOrThrow({ where: { id: to }})
    await prisma.account.update({ where: { id: to }, data: { balance: toAccount.balance + amount } })
  }

  await prisma.account.deleteMany();
  await prisma.account.createMany({
    data: [{ id: '111', balance: 100 }, { id: '222', balance: 100 }]
  });

  await prisma.$transaction(async tx => {
    await transfer('111', '222', 50)
  });

  const fromAccount = await prisma.account.findUniqueOrThrow({ where: { id: '111' }})
  const toAccount = await prisma.account.findUniqueOrThrow({ where: { id: '222' }})
  expect(fromAccount.balance).toBe(50)
  expect(toAccount.balance).toBe(150)
});

test('transaction rolls back in a failed money transfer scenario', async () => {
  const asyncLocalStorage = new AsyncLocalStorage<Context>();
  const originalPrisma = new PrismaClient()
  const prisma = createPrismaProxy(originalPrisma, asyncLocalStorage);

  async function transfer(from: string, to: string, amount: number) {
    const fromAccount = await prisma.account.findUniqueOrThrow({ where: { id: from }})
    await prisma.account.update({ where: { id: from }, data: { balance: fromAccount.balance - amount } })

    const toAccount = await prisma.account.findUniqueOrThrow({ where: { id: `${to} does not exists` }})
    await prisma.account.update({ where: { id: to }, data: { balance: toAccount.balance + amount } })
  }

  await prisma.account.deleteMany();
  await prisma.account.createMany({
    data: [{ id: '111', balance: 100 }, { id: '222', balance: 100 }]
  });

  try {
    await prisma.$transaction(async tx => {
      await transfer('111', '222', 150)
    });
  } catch (e) {
    const fromAccount = await prisma.account.findUniqueOrThrow({ where: { id: '111' }})
    const toAccount = await prisma.account.findUniqueOrThrow({ where: { id: '222' }})
    expect(fromAccount.balance).toBe(100)
    expect(toAccount.balance).toBe(100)
  }
});

test('support array of promises in $transaction', async () => {
  const asyncLocalStorage = new AsyncLocalStorage<Context>();
  const originalPrisma = new PrismaClient()
  const prisma = createPrismaProxy(originalPrisma, asyncLocalStorage);

  await prisma.account.deleteMany();

  await prisma.$transaction([
    prisma.account.create({ data: { id: '111', balance: 100 }}),
    prisma.account.create({ data: { id: '222', balance: 100 }}),
  ]);

  const fromAccount = await prisma.account.findUniqueOrThrow({ where: { id: '111' }});
  const toAccount = await prisma.account.findUniqueOrThrow({ where: { id: '222' }});
  expect(fromAccount.balance).toBe(100);
  expect(toAccount.balance).toBe(100);
});