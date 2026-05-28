import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-3 my-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            <p className="font-semibold">渲染出错</p>
            <p className="mt-1 text-red-400">{this.state.error?.message}</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
