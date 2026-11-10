import { Component, type ReactNode } from 'react'
import { reloadPage } from './reloadPage'

type Props = { children: ReactNode }
type State = { failed: boolean }

// The page's error boundary (features/24_ui_states question 2). It shows the page until a
// part of it throws while it is drawn. After that it shows only a full-page alert, "Something
// went wrong. Reload the page.", with "Reload page", in the look of the other full-page
// screens. A failed request never comes here: a boundary catches only errors thrown while
// drawing, and each request shows its own message in its own place.
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <div className="flex flex-col items-center gap-4">
          <p role="alert" className="text-red-700">
            Something went wrong. Reload the page.
          </p>
          {/* The reloaded page checks the session again, as every page load does. */}
          <button
            type="button"
            onClick={reloadPage}
            className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
          >
            Reload page
          </button>
        </div>
      </main>
    )
  }
}
