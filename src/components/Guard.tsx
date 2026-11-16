// A response with an unexpected shape must not take the whole screen down: a column, a widget or a card is
// wrapped, and a failure is reported in place with what broke. The root boundary (ErrorBoundary.tsx) stays as the
// last line of defence around the whole app; this one is the finer guard, with a way to try again in place.
import { Component, type ReactNode } from 'react'

export class Guard extends Component<{ what: string; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { error: String((e as Error)?.message || e) } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="dstate dstate-bad" role="alert">
        <p><b>{this.props.what} could not be drawn.</b> The API answered with a shape this screen does not expect: {this.state.error}</p>
        <p>Nothing is shown in its place.</p>
        <button className="dbtn" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    )
  }
}
