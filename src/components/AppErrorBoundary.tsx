import React, { type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  declare readonly props: Readonly<AppErrorBoundaryProps>;
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary] Unhandled render error:', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100 flex items-center justify-center">
        <section role="alert" className="w-full max-w-2xl rounded-2xl border border-red-500/50 bg-slate-900 p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-red-300">Application error</p>
          <h1 className="mt-2 text-2xl font-black">This screen could not be displayed.</h1>
          <p className="mt-3 text-sm text-slate-300">
            Your saved records remain in storage. Reload the application and retry the last action. If the problem continues,
            share the diagnostic message below with the administrator.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-red-200 whitespace-pre-wrap">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button type="button" onClick={this.reload} className="mt-5 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold hover:bg-blue-600">
            Reload application
          </button>
        </section>
      </main>
    );
  }
}
