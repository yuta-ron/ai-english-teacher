"use client";

import { motion } from "framer-motion";
import type { SessionStatus } from "@/hooks/useRealtimeSession";

interface StatusIndicatorProps {
  status: SessionStatus;
}

const statusConfig = {
  idle: { label: "起動中...", color: "bg-slate-500", pulse: false },
  connecting: { label: "接続中...", color: "bg-yellow-500", pulse: true },
  listening: { label: "聞いています", color: "bg-green-500", pulse: true },
  speaking: { label: "話しています", color: "bg-blue-500", pulse: true },
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const { label, color, pulse } = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center w-2.5 h-2.5">
        {pulse && (
          <motion.span
            className={`absolute inline-flex w-full h-full rounded-full ${color} opacity-60`}
            animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        )}
        <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${color}`} />
      </div>
      <span className="text-xs text-slate-300 font-medium">{label}</span>
    </div>
  );
}
