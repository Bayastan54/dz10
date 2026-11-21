const base = (
  import.meta.env.VITE_API_BASE_URL || 'https://inai-col3.fishrungames.com/api'
).replace(/\/$/, '')
const sessionKey = 'signal.session'
export const session = {
  get: () => sessionStorage.getItem(sessionKey),
  clear: () => sessionStorage.removeItem(sessionKey),
}
export interface Profile {
  username: string
  first_name: string
  specialization: string
  bio: string
  fee: string
}
type Fields = Record<string, string | undefined>
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
async function request(
  path: string,
  method: string,
  fields?: Fields,
  authenticated = false,
) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (fields) headers['Content-Type'] = 'application/json'
  if (authenticated && session.get())
    headers.Authorization = 'Bearer ' + session.get()
  let res: Response
  try {
    res = await fetch(base + path, {
      method,
      headers,
      credentials: 'include',
      body: fields && JSON.stringify(fields),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new Error(
      'Сервер не ответил. Проверьте соединение и попробуйте ещё раз.',
    )
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail =
      data &&
      typeof data === 'object' &&
      Object.entries(data)
        .map(([key, value]) => key + ' — ' + String(value))
        .join('\n')
    throw new ApiError(
      detail || 'Ошибка сервера (' + res.status + '). Попробуйте ещё раз.',
      res.status,
    )
  }
  return data
}
async function storeAccess(path: string, fields?: Fields) {
  const data = await request(path, 'POST', fields)
  if (typeof data?.access !== 'string' || !data.access)
    throw new Error('Сервер не вернул access-токен.')
  sessionStorage.setItem(sessionKey, data.access)
  return data.access
}
export const roles: Record<string, string> = {
  vocals: 'Вокал',
  guitar: 'Гитара',
  bass: 'Бас-гитара',
  drums: 'Ударные',
  keys: 'Клавишные',
  other: 'Другое',
}
export const api = {
  register: (username: string, password: string) =>
    storeAccess('/register/', { username, password }),
  login: (username: string, password: string) =>
    storeAccess('/login/', { username, password }),
  refresh: () => storeAccess('/token/refresh/'),
  async profile(): Promise<Profile> {
    const data = await request('/profile/', 'GET', undefined, true)
    if (typeof data?.username !== 'string' || !data.profile)
      throw new Error('Не удалось прочитать профиль.')
    return {
      username: data.username,
      first_name: data.profile.first_name ?? '',
      specialization: data.profile.specialization ?? 'other',
      bio: data.profile.bio ?? '',
      fee: data.profile.fee ?? '',
    }
  },
  update: (fields: Fields) => request('/profile/', 'PATCH', fields, true),
  async logout() {
    await request('/logout/', 'POST')
    session.clear()
  },
}
