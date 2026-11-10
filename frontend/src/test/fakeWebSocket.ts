// A stand-in for the browser's WebSocket in every frontend test (features/22_websocket_auth).
// src/test/setup.ts assigns it to globalThis.WebSocket, so no test opens a real connection.
// An instance never opens on its own: a test drives it with open, receive, closeFromServer,
// and failToOpen.
export class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  // Every instance made in the current test, oldest first. setup.ts empties it after each test.
  static instances: FakeWebSocket[] = []

  readonly CONNECTING = FakeWebSocket.CONNECTING
  readonly OPEN = FakeWebSocket.OPEN
  readonly CLOSING = FakeWebSocket.CLOSING
  readonly CLOSED = FakeWebSocket.CLOSED

  readonly url: string
  // The subprotocols asked for, always as a list.
  readonly protocols: string[]
  readyState: number = FakeWebSocket.CONNECTING
  // What the app sent, in order.
  readonly sent: string[] = []
  // Whether the app called close().
  closedByApp = false

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string | URL, protocols?: string | string[]) {
    super()
    this.url = String(url)
    this.protocols = protocols === undefined ? [] : typeof protocols === 'string' ? [protocols] : [...protocols]
    FakeWebSocket.instances.push(this)
  }

  // Like a real socket, it refuses to send before it opens or after it closes.
  send(data: string): void {
    if (this.readyState !== FakeWebSocket.OPEN) {
      throw new DOMException('The socket is not open.', 'InvalidStateError')
    }
    this.sent.push(data)
  }

  close(): void {
    this.closedByApp = true
    this.readyState = FakeWebSocket.CLOSED
  }

  // The server accepts the connection.
  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.fire(new Event('open'))
  }

  // The server sends a message. An object is sent as its JSON text.
  receive(message: unknown): void {
    const data = typeof message === 'string' ? message : JSON.stringify(message)
    this.fire(new MessageEvent('message', { data }))
  }

  // The server, or the network, closes the connection.
  closeFromServer(code = 1000): void {
    this.readyState = FakeWebSocket.CLOSED
    this.fire(new CloseEvent('close', { code, wasClean: code !== 1006 }))
  }

  // The connection cannot be opened: an error, then a close with code 1006.
  failToOpen(): void {
    this.fire(new Event('error'))
    this.closeFromServer(1006)
  }

  private fire(event: Event): void {
    if (event.type === 'open') this.onopen?.(event)
    if (event.type === 'message') this.onmessage?.(event as MessageEvent)
    if (event.type === 'close') this.onclose?.(event as CloseEvent)
    if (event.type === 'error') this.onerror?.(event)
    this.dispatchEvent(event)
  }
}
