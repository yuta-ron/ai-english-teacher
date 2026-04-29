"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ConversationLog } from "@/components/ConversationLog";
import { StatusIndicator } from "@/components/StatusIndicator";
import { AccentSelector, type Accent } from "@/components/AccentSelector";
import { useRealtimeSession } from "@/hooks/useRealtimeSession";

export default function Home() {
  const { status, isPaused, messages, amplitude, connect, disconnect, pause, resume } =
    useRealtimeSession();

  const [accent, setAccent] = useState<Accent>("american");

  useEffect(() => {
    connect(accent);
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccentChange = (newAccent: Accent) => {
    setAccent(newAccent);
    // Reconnect with new accent: disconnect resets statusRef synchronously,
    // so connect() can run immediately after in the same call stack.
    disconnect();
    connect(newAccent);
  };

  const canPause = status === "listening" || status === "speaking";
  const isActive = status !== "idle" && status !== "connecting";

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-start py-6 px-4">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AI English Teacher
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            いつでも気軽に英会話の練習を
          </p>
        </div>

        {/* Main content: side-by-side on PC, stacked on mobile */}
        <div className="flex flex-col md:flex-row gap-4 md:items-stretch">
          {/* Avatar card */}
          <div className="bg-slate-800 rounded-3xl p-6 flex flex-col items-center gap-3 shadow-xl border border-slate-700 md:w-72 md:shrink-0">
            <Avatar status={isPaused ? "idle" : status} amplitude={amplitude} />
            <div className="flex flex-col items-center gap-1">
              <p className="text-white font-semibold text-lg">Alex</p>
              {isPaused ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="text-xs text-slate-400 font-medium">一時停止中</span>
                </div>
              ) : (
                <StatusIndicator status={status} />
              )}
            </div>

            {!isPaused && status === "listening" && (
              <p className="text-slate-400 text-xs text-center max-w-[220px]">
                話しかけてみましょう！
              </p>
            )}
            {isPaused && (
              <p className="text-slate-500 text-xs text-center max-w-[220px]">
                会話を一時停止しています
              </p>
            )}

            {/* Accent selector */}
            <div className="w-full border-t border-slate-700 pt-3">
              <AccentSelector
                value={accent}
                onChange={handleAccentChange}
                disabled={status === "connecting"}
              />
            </div>

            {/* Pause / Resume button */}
            {canPause && (
              <button
                onClick={isPaused ? resume : pause}
                disabled={status === "speaking" && !isPaused}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-colors
                  ${isPaused
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : status === "speaking"
                      ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                      : "bg-slate-600 hover:bg-slate-500 text-white"
                  }`}
              >
                {isPaused ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    再開
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                    一時停止
                  </>
                )}
              </button>
            )}
          </div>

          {/* Conversation log — fixed height with internal scroll */}
          <div className="bg-slate-800 rounded-3xl shadow-xl border border-slate-700 overflow-hidden flex flex-col flex-1">
            <div className="px-4 py-3 border-b border-slate-700 shrink-0 flex items-center justify-between">
              <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                会話ログ
              </p>
              {isActive && (
                <span className="text-slate-500 text-xs">
                  {messages.length} 件
                </span>
              )}
            </div>
            <div className="h-[340px] md:h-[520px] overflow-hidden">
              <ConversationLog messages={messages} />
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="text-center text-slate-500 text-xs leading-relaxed">
          英語で自由に話しかけてください。文法ミスは Alex が優しく訂正します。
        </div>
      </div>
    </main>
  );
}
