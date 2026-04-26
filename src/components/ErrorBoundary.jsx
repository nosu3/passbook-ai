import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-2xl text-center gap-3">
          <p className="text-red-600 font-black text-base">表示エラーが発生しました</p>
          <p className="text-sm text-slate-500">{this.state.error?.message || '不明なエラー'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700"
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
