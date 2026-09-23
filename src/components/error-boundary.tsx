"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-[400px] flex items-center justify-center p-6 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl"
          dir="rtl"
        >
          <div className="max-w-lg w-full text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-100">
                {this.props.fallbackTitle || "حدث خطأ غير متوقع في اللوحة"}
              </h2>
              <p className="text-xs text-slate-400">
                {this.props.fallbackMessage ||
                  "تم احتواء الخطأ بنجاح للحفاظ على سلامة الجلسة والبيانات. يمكنك إعادة المحاولة فوراً."}
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-left font-mono text-[11px] text-rose-300 overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                onClick={this.handleReset}
                className="bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-semibold gap-1.5 h-10 px-5 shadow-lg shadow-teal-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5" /> إعادة تحميل الصفحة
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/super-admin")}
                className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-10 px-4"
              >
                <Home className="h-3.5 w-3.5 ml-1" /> الرئيسية
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
