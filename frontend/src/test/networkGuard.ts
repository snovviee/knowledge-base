// Keeps every frontend test away from other hosts (features/27_local_tests, spec question 4).
// setup.ts installs the guards on the globals of every test file. A request to a host that is
// not this machine is refused before it is sent, its URL is recorded, and the test that made
// it fails when it ends.

// The URLs refused since the record was last taken, oldest first.
const blockedRequests: string[] = []

// This machine: localhost and the names under .localhost, 127.0.0.0/8, and [::1].
function isThisMachine(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname) ||
    hostname === '[::1]'
  )
}

// Returns the error for a URL on another host, after recording it, and nothing for a URL on
// this machine. The URL is read against the page's address, so a relative URL is local.
function refusal(url: string | URL): Error | undefined {
  const target = new URL(url, globalThis.location.href)
  if (isThisMachine(target.hostname)) return undefined
  blockedRequests.push(target.href)
  return new Error(`Blocked a request to another host in a test: ${target.href}`)
}

// A fetch that rejects a request to another host, and passes any other to realFetch.
export function guardFetch(realFetch: typeof fetch): typeof fetch {
  return (...args: Parameters<typeof fetch>) => {
    const [input] = args
    const error = refusal(input instanceof Request ? input.url : input)
    return error ? Promise.reject(error) : realFetch(...args)
  }
}

// An XMLHttpRequest whose open throws for a URL on another host, and opens any other one.
export function guardXMLHttpRequest(RealXMLHttpRequest: typeof XMLHttpRequest): typeof XMLHttpRequest {
  return class GuardedXMLHttpRequest extends RealXMLHttpRequest {
    open(
      ...args: [method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null]
    ): void {
      const error = refusal(args[1])
      if (error) throw error
      Reflect.apply(super.open, this, args)
    }
  }
}

// A WebSocket whose constructor throws for a URL on another host, and opens any other one.
export function guardWebSocket(RealWebSocket: typeof WebSocket): typeof WebSocket {
  return class GuardedWebSocket extends RealWebSocket {
    constructor(...args: ConstructorParameters<typeof WebSocket>) {
      const error = refusal(args[0])
      if (error) throw error
      super(...args)
    }
  }
}

// Returns the refused URLs, and clears the record. Only the guard's own tests call it, after
// the refusals they make on purpose.
export function takeBlockedRequests(): string[] {
  return blockedRequests.splice(0)
}

// The globals that the guards replace: globalThis in setup.ts.
interface NetworkGlobals {
  fetch: typeof fetch
  XMLHttpRequest: typeof XMLHttpRequest
  WebSocket: typeof WebSocket
}

// Puts the three guards on target, and hands afterEach a hook that fails a test that made a
// refused request, even when its code caught the refusal, and clears the record.
export function installNetworkGuard({
  target,
  afterEach,
}: {
  target: NetworkGlobals
  afterEach: (hook: () => void) => void
}): void {
  target.fetch = guardFetch(target.fetch)
  target.XMLHttpRequest = guardXMLHttpRequest(target.XMLHttpRequest)
  target.WebSocket = guardWebSocket(target.WebSocket)
  afterEach(() => {
    const urls = takeBlockedRequests()
    if (urls.length > 0) throw new Error(`A test tried to reach another host: ${urls.join(', ')}`)
  })
}
