// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import TreeEditor from "./TreeEditor";

// 最小の ErrorBoundary（白画面を避け、エラーを表示）
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error?: Error}> {
  constructor(props:any){ super(props); this.state = { error: undefined }; }
  static getDerivedStateFromError(error: Error){ return { error }; }
  componentDidCatch(error: Error, info: any){ console.error("ErrorBoundary:", error, info); }
  render(){
    if (this.state.error) {
      return (
        <div style={{padding:16,fontFamily:"monospace",whiteSpace:"pre-wrap",color:"#b91c1c"}}>
          <div style={{fontWeight:"bold"}}>Runtime Error</div>
          {String(this.state.error?.message || this.state.error)}
        </div>
      );
    }
    return this.props.children as any;
  }
}

const el = document.getElementById("root");
if (!el) throw new Error("#root not found in index.html");

createRoot(el).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TreeEditor />
    </ErrorBoundary>
  </React.StrictMode>
);

