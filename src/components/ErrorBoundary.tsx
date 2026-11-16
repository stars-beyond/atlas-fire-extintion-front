// Last line of defence around the whole app: a render error (usually an API answer with an unexpected shape)
// shows a message and a way back instead of a blank page. The dashboard keeps its own finer guards per widget.
import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { error: String((e as Error)?.message || e) } }
  componentDidCatch(e: unknown) { console.error('Atlas: render error', e) }
  render() {
    if (this.state.error === null) return this.props.children
    return (
      <div className="boot" role="alert">
        <h1>This screen could not be drawn</h1>
        <p>The Atlas received something it did not expect: <span className="mono">{this.state.error}</span></p>
        <button className="cta" onClick={() => location.reload()}>Reload the Atlas</button>
      </div>
    )
  }
}
