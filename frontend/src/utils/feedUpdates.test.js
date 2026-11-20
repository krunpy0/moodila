import assert from 'node:assert/strict'
import { test } from 'node:test'
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { handlePushMessage, refreshFeed, trimFeedToFirstPage } from './feedUpdates.js'
import { queryKeys } from '../api/queryKeys.js'

test('push preserves twenty loaded pages; explicit refresh fetches only the first page', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const calls = []
  const key = queryKeys.feed(false)
  const observer = new InfiniteQueryObserver(client, {
    queryKey: key,
    initialPageParam: 0,
    staleTime: Infinity,
    queryFn: async ({ pageParam }) => {
      calls.push(pageParam)
      return { items: [{ id: pageParam }], next_cursor: pageParam + 1 }
    },
    getNextPageParam: (page) => page.next_cursor,
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    await observer.refetch()
    for (let i = 1; i < 20; i++) await observer.fetchNextPage()
    const loaded = client.getQueryData(key)
    calls.length = 0
    for (const type of ['PUSH_NOTIFICATION_RECEIVED', 'PUSH_NOTIFICATION_READ']) {
      handlePushMessage(client, { type })
      await Promise.resolve()
      assert.equal(client.getQueryData(key), loaded)
      assert.deepEqual(calls, [])
    }
    await refreshFeed(client, key)
    assert.deepEqual(calls, [0])
    assert.equal(client.getQueryData(key).pages.length, 1)
    await observer.fetchNextPage()
    assert.deepEqual(calls, [0, 1])
  } finally {
    unsubscribe()
    client.clear()
  }
})

test('unrelated worker messages do not invalidate queries', () => {
  handlePushMessage({ invalidateQueries: () => assert.fail('unexpected invalidation') }, { type: 'OTHER' })
  handlePushMessage({ invalidateQueries: () => assert.fail('unexpected invalidation') }, null)
})

test('leaving a stale feed keeps its first cursor and remount fetches only one page', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const key = queryKeys.feed(false)
  const data = {
    pages: Array.from({ length: 20 }, (_, i) => ({ items: [{ id: i }], next_cursor: i + 1 })),
    pageParams: Array.from({ length: 20 }, (_, i) => i),
  }
  const updatedAt = Date.now() - 60_000
  client.setQueryData(key, data, { updatedAt })
  client.setQueryData(queryKeys.feed(true), data)
  client.setQueryData(queryKeys.comments('entry'), [{ id: 'comment' }])
  trimFeedToFirstPage(client, key)
  assert.deepEqual(client.getQueryData(key), { pages: [data.pages[0]], pageParams: [0] })
  assert.equal(client.getQueryState(key).dataUpdatedAt, updatedAt)
  assert.equal(client.getQueryData(queryKeys.feed(true)), data)
  assert.deepEqual(client.getQueryData(queryKeys.comments('entry')), [{ id: 'comment' }])

  const calls = []
  const observer = new InfiniteQueryObserver(client, {
    queryKey: key,
    initialPageParam: 0,
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      calls.push(pageParam)
      return { items: [{ id: pageParam }], next_cursor: pageParam + 1 }
    },
    getNextPageParam: (page) => page.next_cursor,
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    await observer.refetch({ cancelRefetch: false })
    assert.deepEqual(calls, [0])
    await observer.fetchNextPage()
    assert.deepEqual(calls, [0, 1])
  } finally {
    unsubscribe()
    client.clear()
  }
})

test('trimming preserves push invalidation and does not recreate a cleared cache', async () => {
  const client = new QueryClient()
  const key = queryKeys.feed(false)
  try {
    const updatedAt = Date.now()
    client.setQueryData(key, { pages: [{ items: [] }], pageParams: [undefined] }, { updatedAt })
    trimFeedToFirstPage(client, key)
    assert.equal(client.getQueryState(key).dataUpdatedAt, updatedAt)
    assert.equal(client.getQueryState(key).isInvalidated, false)
    await client.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' })
    trimFeedToFirstPage(client, key)
    assert.equal(client.getQueryState(key).isInvalidated, true)
    client.clear()
    trimFeedToFirstPage(client, key)
    assert.equal(client.getQueryState(key), undefined)
  } finally {
    client.clear()
  }
})

test('a pending next page cannot restore pages discarded on leaving the feed', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const key = queryKeys.feed(false)
  client.setQueryData(key, {
    pages: [{ items: [{ id: 0 }], next_cursor: 1 }],
    pageParams: [0],
  })
  const { promise, resolve } = Promise.withResolvers()
  const observer = new InfiniteQueryObserver(client, {
    queryKey: key,
    initialPageParam: 0,
    staleTime: Infinity,
    queryFn: () => promise,
    getNextPageParam: (page) => page.next_cursor,
  })
  const unsubscribe = observer.subscribe(() => {})
  const pending = observer.fetchNextPage()
  unsubscribe()
  try {
    trimFeedToFirstPage(client, key)
    resolve({ items: [{ id: 1 }], next_cursor: 2 })
    await pending
    assert.deepEqual(client.getQueryData(key).pageParams, [0])
    assert.equal(client.getQueryData(key).pages.length, 1)
    assert.equal(client.getQueryState(key).fetchStatus, 'idle')
  } finally {
    resolve({ items: [], next_cursor: '' })
    client.clear()
  }
})

test('a first-page request survives cleanup and immediate remount without a duplicate', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const key = queryKeys.feed(false)
  const page = { items: [{ id: 0 }], next_cursor: 1 }
  client.setQueryData(key, { pages: [page], pageParams: [0] }, { updatedAt: 1 })
  const { promise, resolve } = Promise.withResolvers()
  let calls = 0
  const options = {
    queryKey: key,
    initialPageParam: 0,
    queryFn: () => { calls++; return promise },
    getNextPageParam: (data) => data.next_cursor,
  }
  const first = new InfiniteQueryObserver(client, options)
  const unsubscribeFirst = first.subscribe(() => {})
  unsubscribeFirst()
  trimFeedToFirstPage(client, key)
  const remounted = new InfiniteQueryObserver(client, options)
  const unsubscribe = remounted.subscribe(() => {})
  try {
    resolve(page)
    await remounted.refetch({ cancelRefetch: false })
    assert.equal(calls, 1)
  } finally {
    unsubscribe()
    resolve(page)
    client.clear()
  }
})
