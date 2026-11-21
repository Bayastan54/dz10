import { useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { Chat } from './Chat'
import { api, ApiError, roles, session, type Profile } from './api'
import './style.css'

type View = 'chat' | 'login' | 'register' | 'profile' | 'edit'
const titles = {
  chat: 'Общий чат',
  login: 'Вход в клуб',
  register: 'Регистрация',
  profile: 'Мой профиль',
  edit: 'Редактирование',
}
const submitLabels = {
  login: 'Войти',
  register: 'Создать аккаунт',
  edit: 'Сохранить изменения',
}

function App() {
  const [view, setView] = useState<View>(session.get() ? 'chat' : 'login')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [connection, setConnection] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const signedIn = view === 'chat' || view === 'profile' || view === 'edit'

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label)
    setError('')
    setNotice('')
    try {
      await task()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && session.get()) {
        session.clear()
        setProfile(null)
        setView('login')
        setError('Сессия закончилась. Войдите ещё раз.')
      } else
        setError(
          e instanceof Error ? e.message : 'Не удалось выполнить запрос.',
        )
    } finally {
      setBusy('')
    }
  }
  const loadProfile = async () => {
    setProfile(await api.profile())
  }
  useEffect(() => {
    if (session.get())
      void run('Проверяем сессию…', async () => {
        try {
          await loadProfile()
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 401) throw e
          await api.refresh()
          await loadProfile()
          setConnection((n) => n + 1)
        }
      })
  }, [])
  function change(next: View) {
    setView(next)
    setError('')
    setNotice('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const read = (key: string) => String(form.get(key) ?? '')
    if (view === 'register' && read('password') !== read('confirm')) {
      setError('Пароли должны совпадать.')
      return
    }
    void run(
      view === 'edit'
        ? 'Сохраняем профиль…'
        : view === 'register'
          ? 'Создаём аккаунт…'
          : 'Входим…',
      async () => {
        if (view === 'edit') {
          await api.update({
            first_name: read('first_name').trim(),
            specialization: read('specialization'),
            bio: read('bio').trim(),
            fee: read('fee') || undefined,
          })
          setProfile(null)
          setView('profile')
          await loadProfile()
          setNotice('Изменения сохранены.')
        } else {
          const username = read('username').trim()
          const password = read('password')
          if (view === 'register') {
            await api.register(username, password)
          } else {
            await api.login(username, password)
          }
          setView('chat')
          await loadProfile()
        }
      },
    )
  }
  function logout() {
    run('Выходим…', async () => {
      await api.logout()
      setProfile(null)
      change('login')
      setNotice('Вы вышли из аккаунта.')
    })
  }
  return (
    <>
      {busy && (
        <div className="loading" role="status">
          {busy}
        </div>
      )}
      <header>
        <b className="logo">◉ СИГНАЛ</b>
        <span>Музыкальная группа</span>
      </header>
      <main>
        <section className="sleeve" aria-label="Обложка группы Сигнал">
          <div className="genre">АЛЬТЕРНАТИВНЫЙ РОК</div>
          <h1>
            Сигнал<span>.</span>
          </h1>
          <div className="vinyl" aria-hidden="true">
            <div className="label">
              СИГНАЛ
              <i />
            </div>
          </div>
          <div className="caption">
            Бишкек <span>✳</span> Кыргызстан
          </div>
        </section>
        <section className="panel" aria-busy={Boolean(busy)}>
          <small>ФАН-КЛУБ ГРУППЫ</small>
          <h2>{titles[view]}</h2>
          {signedIn && (
            <nav aria-label="Кабинет">
              <button
                disabled={!!busy}
                aria-pressed={view === 'chat'}
                onClick={() => change('chat')}
              >
                Чат
              </button>
              <button
                disabled={!!busy}
                aria-pressed={view !== 'chat'}
                onClick={() => change('profile')}
              >
                Профиль
              </button>
              <button disabled={!!busy} onClick={logout}>
                Выйти
              </button>
            </nav>
          )}
          {signedIn && <Chat key={connection} hidden={view !== 'chat'} />}
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {view === 'chat' ? null : view === 'profile' ? (
            <>
              {profile ? (
                <dl>
                  <div>
                    <dt>Логин</dt>
                    <dd>{profile.username || '—'}</dd>
                  </div>
                  <div>
                    <dt>Имя</dt>
                    <dd>{profile.first_name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Инструмент</dt>
                    <dd>{roles[profile.specialization] || '—'}</dd>
                  </div>
                  <div>
                    <dt>О себе</dt>
                    <dd>{profile.bio || '—'}</dd>
                  </div>
                  <div>
                    <dt>Гонорар</dt>
                    <dd>{profile.fee || '—'}</dd>
                  </div>
                </dl>
              ) : (
                <button
                  disabled={!!busy}
                  onClick={() => void run('Загружаем профиль…', loadProfile)}
                >
                  Загрузить профиль
                </button>
              )}
              {profile && (
                <button disabled={!!busy} onClick={() => change('edit')}>
                  Редактировать профиль
                </button>
              )}
            </>
          ) : (
            <form key={view} onSubmit={submit}>
              <fieldset disabled={!!busy}>
                {view !== 'edit' && (
                  <label>
                    Логин
                    <input
                      name="username"
                      autoComplete="username"
                      maxLength={150}
                      required
                      pattern={'.*\\S.*'}
                    />
                  </label>
                )}
                {view === 'edit' && (
                  <>
                    <label>
                      Имя
                      <input
                        name="first_name"
                        maxLength={100}
                        defaultValue={profile?.first_name}
                      />
                    </label>
                    <label>
                      Инструмент
                      <select
                        name="specialization"
                        defaultValue={profile?.specialization}
                      >
                        {Object.entries(roles).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      О себе
                      <textarea name="bio" defaultValue={profile?.bio} />
                    </label>
                    <label>
                      Гонорар
                      <input
                        name="fee"
                        type="number"
                        step=".01"
                        required={Boolean(profile?.fee)}
                        defaultValue={profile?.fee}
                      />
                    </label>
                  </>
                )}
                {view !== 'edit' && (
                  <label>
                    Пароль
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={view === 'register' ? 6 : undefined}
                      autoComplete={
                        view === 'login' ? 'current-password' : 'new-password'
                      }
                    />
                  </label>
                )}
                {view === 'register' && (
                  <label>
                    Повторите пароль
                    <input
                      name="confirm"
                      type="password"
                      required
                      autoComplete="new-password"
                    />
                  </label>
                )}
                <button type="submit">
                  {submitLabels[view]} <span aria-hidden="true">↗</span>
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    change(
                      view === 'login'
                        ? 'register'
                        : view === 'edit'
                          ? 'profile'
                          : 'login',
                    )
                  }
                >
                  {view === 'login'
                    ? 'Зарегистрироваться'
                    : view === 'edit'
                      ? 'Отмена'
                      : 'Уже есть аккаунт? Войти'}
                </button>
              </fieldset>
            </form>
          )}
        </section>
      </main>
    </>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
