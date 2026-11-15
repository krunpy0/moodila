import assert from 'node:assert/strict'
import { test } from 'node:test'
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { handlePushMessage, refreshFeed } from './feedUpdates.js'
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
