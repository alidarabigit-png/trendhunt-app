import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#17212b] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/30">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold mb-2">مینی‌آپ نفیس تجارت</h2>
          <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
            ارتباط با سرور یا پردازش کاتالوگ با وقفه مواجه شد. لطفاً روی دکمه زیر بزنید تا صفحه مجدداً بارگذاری شود.
          </p>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>بارگذاری مجدد مینی‌آپ</span>
          </button>
          {this.state.error && (
            <details className="mt-8 text-left text-[10px] text-slate-500 max-w-md bg-black/40 p-3 rounded-xl border border-white/5 font-mono">
              <summary className="cursor-pointer">جزئیات فنی خطا</summary>
              <pre className="mt-2 whitespace-pre-wrap">{this.state.error.toString()}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
