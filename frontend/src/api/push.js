import { api } from './client'

export function fetchVAPIDPublicKey() {
  return api('/notifications/vapid-public-key')
}

export function savePushSubscription(subscription, locale) {
  const lang = locale || (typeof localStorage !== 'undefined' ? localStorage.getItem('moodshare_lang') : 'ru') || 'ru'
  return api('/notifications/push-subscription', {
    method: 'POST',
    body: JSON.stringify({ ...subscription, locale: lang }),
  })
}

export function removePushSubscription(endpoint) {
  return api('/notifications/push-subscription', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPushNotifications() {
  const isEn = typeof localStorage !== 'undefined' && localStorage.getItem('moodshare_lang') === 'en'

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error(isEn ? 'Push notifications not supported by your browser' : 'Push-уведомления не поддерживаются вашим браузером')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(isEn ? 'Push notifications permission denied' : 'Разрешение на push-уведомления отклонено')
  }

  const registration = await navigator.serviceWorker.ready
  const { public_key } = await fetchVAPIDPublicKey()

  if (!public_key) {
    throw new Error(isEn ? 'Server did not return VAPID key' : 'Сервер не вернул VAPID ключ')
  }

  const convertedVapidKey = urlBase64ToUint8Array(public_key)

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    })
  }

  const subJSON = subscription.toJSON()
  const lang = isEn ? 'en' : 'ru'
  await savePushSubscription(subJSON, lang)

  return subJSON
}

export async function unsubscribeFromPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    await removePushSubscription(endpoint).catch(() => {})
  }
}

export async function getPushSubscriptionState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, subscribed: false, permission: 'denied' }
  }
  const permission = Notification.permission
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return {
    supported: true,
    subscribed: Boolean(subscription),
    permission,
  }
}
