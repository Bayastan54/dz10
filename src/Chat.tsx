import { useEffect, useRef, useState, type FormEvent } from 'react'
import { session } from './api'

type Message = { sender: string; text: string; timestamp: number }
type Status = 'connecting' | 'ready' | 'closed'
export function Chat({ hidden }: { hidden: boolean }) {
  const [status, setStatus] = useState<Status>('connecting')
  const [username, setUsername] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [attempt, setAttempt] = useState(0)
  const socket = useRef<WebSocket | null>(null)
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ws = new WebSocket('wss://inai-col3.fishrungames.com/chat/')
    socket.current = ws
    let authorized = false
    const timer = window.setTimeout(() => ws.close(), 12000)
    ws.onopen = () =>
      ws.send(
        JSON.stringify({ type: 'AUTH', payload: { token: session.get() } }),
      )
    ws.onmessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      const payload = message?.payload
      if (
        message?.type === 'AUTH_SUCCESS' &&
        typeof payload?.username === 'string'
      ) {
        clearTimeout(timer)
        authorized = true
        setUsername(payload.username)
        setStatus('ready')
      }
      if (
        authorized &&
        message?.type === 'NEW_MESSAGE' &&
        typeof payload?.text === 'string' &&
        typeof payload.sender === 'string' &&
        Number.isFinite(payload.timestamp)
      ) {
        setMessages((items) => [...items, payload])
      }
    }
    ws.onclose = () => {
      clearTimeout(timer)
      setStatus('closed')
    }
    return () => {
      clearTimeout(timer)
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      socket.current = null
      ws.close()
    }
  }, [attempt])
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, hidden])
  function send(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (
      !text ||
      status !== 'ready' ||
      socket.current?.readyState !== WebSocket.OPEN
    )
      return
    socket.current.send(
      JSON.stringify({ type: 'CHAT_MESSAGE', payload: { text } }),
    )
    setDraft('')
  }
  function reconnect() {
    setStatus('connecting')
    setAttempt(attempt + 1)
  }
  let statusText = 'Подключаемся к чату…'
  if (status === 'ready') statusText = 'В эфире · ' + username
  if (status === 'closed')
    statusText = 'Соединение закрыто. Можно подключиться ещё раз.'
  return (
    <section hidden={hidden} className="chat">
      <p role="status" className={'state ' + status}>
        {statusText}
      </p>
      {status === 'closed' && (
        <button onClick={reconnect}>Подключиться снова</button>
      )}
      <div
        role="log"
        aria-label="Сообщения группы"
        className="messages"
        ref={log}
      >
        {!messages.length && (
          <p>Здесь появятся сообщения участников. Начните разговор!</p>
        )}
        {messages.map((msg, i) => (
          <article className={msg.sender === username ? 'own' : ''} key={i}>
            <b>{msg.sender}</b>{' '}
            <time>
              {new Date(msg.timestamp).toLocaleTimeString('ru', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
            <p>{msg.text}</p>
          </article>
        ))}
      </div>
      <form onSubmit={send}>
        <label>
          Сообщение
          <input
            disabled={status !== 'ready'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Напишите группе…"
          />
        </label>
        <button disabled={status !== 'ready' || !draft.trim()}>
          Отправить ↗
        </button>
      </form>
    </section>
  )
}
