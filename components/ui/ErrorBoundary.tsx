'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-semibold">Something went wrong</h2>
          </div>
          <pre className="text-xs font-mono p-3 rounded-xl bg-black/5 dark:bg-white/5 overflow-auto max-h-48 whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <p className="text-sm text-muted-foreground">
            Your data is safe (it&apos;s in localStorage). Try recovering, or reload the page. If this keeps happening, export a backup from Settings → Data and report it.
          </p>
          <div className="flex gap-2">
            <button onClick={this.reset} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
              Recover
            </button>
            <button onClick={() => window.location.reload()} className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
