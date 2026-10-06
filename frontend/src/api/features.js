import { api } from './client'

export async function getAppFeatures() {
  return api('/app/features')
}
