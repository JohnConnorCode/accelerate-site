"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Unknown error" };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[AdminErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "" });
  };

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md w-full rounded-xl border border-border-glass bg-bg-elevated p-6 text-center shadow-xl">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <h2 className="text-lg font-display font-semibold text-white-primary">
            Something went wrong in this section
          </h2>
          <p className="mt-1 text-sm text-white-muted">
            {this.state.message}
          </p>
          <p className="mt-3 text-xs text-white-muted">
            Try again. If it keeps happening, reach out to John at john@acceleratewith.us.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={this.handleReset}
              className="rounded-lg border border-border-glass px-3 py-1.5 text-sm text-white-primary transition-colors hover:bg-white/5 cursor-pointer"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-1.5 text-sm font-semibold text-black hover:brightness-110 transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
