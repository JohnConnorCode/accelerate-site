"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[AdminErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="flex min-h-[60vh] items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md rounded-[var(--admin-surface-radius)] bg-[var(--admin-surface)] p-5 text-center shadow-[var(--admin-shadow-border),0_28px_64px_-38px_rgba(0,0,0,0.42)] sm:p-6">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="size-5" />
          </div>
          <h2 className="mt-4 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
            Something went wrong in this section
          </h2>
          <p className="admin-copy mt-2 text-pretty text-sm">
            This section could not be displayed. Try again to reopen it.
          </p>
          <p className="admin-copy mt-3 text-xs">
            If you just submitted a change, check its status before repeating it. Reloading may
            discard unsaved edits. If this keeps happening, check Setup Center.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="admin-button admin-button--primary"
            >
              <RefreshCw className="size-3.5" />
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
