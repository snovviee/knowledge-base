// The app's WebSocket (features/22_websocket_auth): /cable on the page's own host, with
// wss: when the page is served over https, so ws://localhost:3000/cable locally.
export function cableUrl(location: Pick<Location, 'protocol' | 'host'> = window.location): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/cable`
}

// Action Cable's JSON protocol, and the one channel the app subscribes to.
const PROTOCOL = 'actioncable-v1-json'
const REVIEW_REMINDERS = JSON.stringify({ channel: 'ReviewRemindersChannel' })

// The wait before the client connects again after a loss: 1 s, then twice as long after
// each attempt that fails, up to 30 s, so two attempts are never more than 30 s apart. A
// welcome starts again from 1 s (features/20_realtime_notifications question 8).
const FIRST_RETRY_WAIT_MS = 1_000
const LONGEST_RETRY_WAIT_MS = 30_000
// Action Cable pings every 3 s. An open socket that receives no frame at all for this long
// is stale: the network failed with no close. The client closes it and counts it as lost.
const STALE_AFTER_MS = 10_000

export interface Cable {
  // Sends a message on the reminders subscription, such as the ack of
  // features/23_websocket_client_message (question 1): Action Cable's message command, with
  // { action, ...data } as JSON text in its data. It sends only while the socket is open, and
  // returns whether it sent: before the socket opens, while it closes, and after a loss it
  // sends nothing and returns false (question 5).
  perform: (action: string, data: Record<string, unknown>) => boolean
  // Ends the connection from the app's side, and any retry: no handler is called after it.
  close: () => void
}

export interface CableHandlers {
  // The server refused the connection, or closed it and told the app not to reconnect: the
  // sign-in has ended (questions 3 to 5).
  onSignedOut: () => void
  // A message of the reminders subscription, such as a batch, before or after the
  // subscription's confirmation (features/20_realtime_notifications question 4).
  onMessage: (message: unknown) => void
  // The connection was lost, or could not be opened. The client connects again on its own
  // (features/20_realtime_notifications question 8).
  onLost: () => void
}

// Server messages the app reads. A message of a subscription has its identifier and no type.
// Pings and anything else are ignored here.
interface ServerMessage {
  type?: string
  reconnect?: boolean
  identifier?: string
  message?: unknown
}

// Opens the app's connection. After the server's welcome, it subscribes to the user's review
// reminders. The browser sends its session cookie with the connection request, and nothing
// else names the user: no token and no user id (question 1).
//
// A close that no refusal came before is a loss, and so is a stale socket: the client
// reports it and opens a new socket after the retry wait (features/20_realtime_notifications
// question 8). The refusal and close() end the connection for good.
export function openCable({ onSignedOut, onMessage, onLost }: CableHandlers): Cable {
  // The current socket, or none while a retry waits.
  let socket: WebSocket | undefined
  let retryWait = FIRST_RETRY_WAIT_MS
  let retry: ReturnType<typeof setTimeout> | undefined
  let stale: ReturnType<typeof setTimeout> | undefined
  // The sign-in has ended, or the app closed the connection.
  let ended = false

  // The current socket is lost: from now on its events are ignored, its late close
  // included, and a new socket opens after the wait.
  const lose = () => {
    clearTimeout(stale)
    socket = undefined
    onLost()
    retry = setTimeout(connect, retryWait)
    retryWait = Math.min(retryWait * 2, LONGEST_RETRY_WAIT_MS)
  }

  const connect = () => {
    const current = new WebSocket(cableUrl(), [PROTOCOL])
    socket = current
    // Only the current socket counts. A real socket fires its close event some time after
    // close() was called on it, and that late close is not a loss.
    const counts = () => !ended && socket === current
    // Runs while the socket is open, from its last frame.
    const watch = () => {
      clearTimeout(stale)
      stale = setTimeout(() => {
        current.close()
        lose()
      }, STALE_AFTER_MS)
    }

    current.onopen = () => {
      if (counts()) watch()
    }

    current.onmessage = (event: MessageEvent<string>) => {
      if (!counts()) return
      watch()
      const message = JSON.parse(event.data) as ServerMessage
      if (message.type === 'welcome') {
        retryWait = FIRST_RETRY_WAIT_MS
        current.send(JSON.stringify({ command: 'subscribe', identifier: REVIEW_REMINDERS }))
      } else if (message.type === 'disconnect' && message.reconnect === false) {
        // The refusal, a logout's close, or the close of a sign-in that is gone. The close
        // that follows is not a loss, and no new socket opens (features/22_websocket_auth
        // question 3). Action Cable's other closes, such as a server restart's
        // "reconnect": true, are losses.
        ended = true
        clearTimeout(stale)
        onSignedOut()
      } else if (message.type === undefined && message.identifier === REVIEW_REMINDERS) {
        onMessage(message.message)
      }
    }

    current.onclose = () => {
      if (counts()) lose()
    }
  }

  connect()
  return {
    perform: (action, data) => {
      if (socket?.readyState !== WebSocket.OPEN) return false
      const command = { command: 'message', identifier: REVIEW_REMINDERS, data: JSON.stringify({ action, ...data }) }
      socket.send(JSON.stringify(command))
      return true
    },
    close: () => {
      ended = true
      clearTimeout(retry)
      clearTimeout(stale)
      socket?.close()
    },
  }
}
