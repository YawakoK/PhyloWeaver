// src/App.tsx
import { useState } from "react";
import "./App.css";
import TreeEditor from "./TreeEditor";
import { useVersionCheck } from "./useVersionCheck";
import { APP_VERSION } from "./version";

export default function App() {
  // Controls visibility of the “new version available” toast
  const [showUpdateToast, setShowUpdateToast] = useState(false);

  // Start polling version.json when the app is mounted
  useVersionCheck({
    onUpdateDetected: () => setShowUpdateToast(true),
    intervalMs: 30000, // Check every 30 seconds
  });

  return (
    <>
      {/* Main application UI */}
      <TreeEditor />

      {/* Update notification toast */}
      {showUpdateToast && (
        <div className="fixed right-4 bottom-4 bg-amber-100 border border-amber-300 rounded-xl px-4 py-3 shadow-lg text-sm flex items-center gap-3 z-50">
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">
              A new version of this site is available.
            </span>
            <span className="text-xs text-slate-700">
              Current version: {APP_VERSION}. Reload the page to use the latest
              version.
            </span>
          </div>
          <button
            className="px-3 py-1 rounded-md bg-amber-400 hover:bg-amber-500 text-slate-900 text-sm font-semibold"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            className="px-2 py-1 rounded-md border border-amber-300 text-slate-700 text-xs"
            onClick={() => setShowUpdateToast(false)}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
