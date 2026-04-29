"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "@/hooks/useRealtimeSession";

interface ConversationLogProps {
  messages: Message[];
}

export function ConversationLog({ messages }: ConversationLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        会話が始まるとここに表示されます
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <span className="text-xs text-slate-400 px-1">
              {msg.role === "user" ? "あなた" : "Alex"}
            </span>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-slate-700 text-slate-100 rounded-tr-sm"
                  : "bg-blue-600 text-white rounded-tl-sm"
              }`}
            >
              {msg.text}
              {msg.translation && (
                <p className="mt-1.5 pt-1.5 border-t border-white/20 text-xs text-blue-100/80 leading-relaxed">
                  {msg.translation}
                </p>
              )}
            </div>
            {msg.correction && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ delay: 0.3, duration: 0.2 }}
                className="max-w-[85%] rounded-xl px-3 py-2 bg-amber-900/40 border border-amber-600/40 text-amber-300 text-xs flex items-start gap-2"
              >
                <span className="mt-0.5 shrink-0">✏️</span>
                <span>
                  <span className="font-semibold">ヒント: </span>
                  {msg.correction}
                </span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
