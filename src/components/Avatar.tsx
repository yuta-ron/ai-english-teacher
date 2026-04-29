"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect, useRef } from "react";
import type { SessionStatus } from "@/hooks/useRealtimeSession";

interface AvatarProps {
  status: SessionStatus;
  amplitude: number;
}

export function Avatar({ status, amplitude }: AvatarProps) {
  const controls = useAnimation();
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isListening = status === "listening";
  const isSpeaking = status === "speaking";
  const isConnecting = status === "connecting";

  const mouthOpen = isSpeaking ? Math.min(amplitude * 2.5, 1) : 0;
  const mouthHeight = 4 + mouthOpen * 12;
  const mouthY = 160 + mouthOpen * 2;
  const pupilScale = isListening ? 1.15 : 1;

  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 2000;
      blinkTimerRef.current = setTimeout(async () => {
        await controls.start({ scaleY: 0.05 }, { duration: 0.08 });
        await controls.start({ scaleY: 1 }, { duration: 0.1 });
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [controls]);

  const faceColor = "#FFDAB9";
  const hairColor = "#4A3728";
  const eyeWhite = "#FFFFFF";
  const pupilColor = "#2C1810";
  const cheekColor = "#FFB8A0";
  const lipColor = isSpeaking ? "#E8826B" : "#D4816B";
  const shirtColor = "#7BB8E8";

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={
          isSpeaking
            ? { y: [0, -3, 0] }
            : isListening
              ? { y: [0, -1, 0] }
              : { y: [0, -2, 0] }
        }
        transition={{
          duration: isSpeaking ? 0.4 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <svg
          width="220"
          height="260"
          viewBox="0 0 220 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hair back */}
          <ellipse cx="110" cy="88" rx="68" ry="72" fill={hairColor} />

          {/* Neck */}
          <rect x="94" y="185" width="32" height="30" fill={faceColor} rx="4" />

          {/* Shirt */}
          <ellipse cx="110" cy="248" rx="70" ry="30" fill={shirtColor} />
          <rect x="40" y="230" width="140" height="30" fill={shirtColor} rx="8" />

          {/* Face */}
          <ellipse cx="110" cy="118" rx="60" ry="68" fill={faceColor} />

          {/* Hair front */}
          <ellipse cx="110" cy="60" rx="68" ry="35" fill={hairColor} />
          <ellipse cx="56" cy="100" rx="16" ry="30" fill={hairColor} />
          <ellipse cx="164" cy="100" rx="16" ry="30" fill={hairColor} />

          {/* Eyebrows */}
          <motion.g
            animate={isListening ? { y: -2 } : { y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <path
              d="M76 88 Q86 84 96 88"
              stroke={hairColor}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M124 88 Q134 84 144 88"
              stroke={hairColor}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </motion.g>

          {/* Eyes */}
          <motion.g animate={controls} style={{ originY: "50%" }}>
            {/* Left eye */}
            <ellipse cx="86" cy="108" rx="13" ry="14" fill={eyeWhite} />
            <motion.ellipse
              cx="86"
              cy="109"
              rx="8"
              ry="8"
              fill={pupilColor}
              animate={{ scale: pupilScale }}
              transition={{ duration: 0.2 }}
            />
            <ellipse cx="89" cy="106" rx="3" ry="3" fill="white" opacity="0.7" />

            {/* Right eye */}
            <ellipse cx="134" cy="108" rx="13" ry="14" fill={eyeWhite} />
            <motion.ellipse
              cx="134"
              cy="109"
              rx="8"
              ry="8"
              fill={pupilColor}
              animate={{ scale: pupilScale }}
              transition={{ duration: 0.2 }}
            />
            <ellipse cx="137" cy="106" rx="3" ry="3" fill="white" opacity="0.7" />
          </motion.g>

          {/* Nose */}
          <path
            d="M107 130 Q110 138 113 130"
            stroke="#C4927A"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Cheeks */}
          <ellipse cx="74" cy="148" rx="14" ry="9" fill={cheekColor} opacity="0.4" />
          <ellipse cx="146" cy="148" rx="14" ry="9" fill={cheekColor} opacity="0.4" />

          {/* Mouth */}
          <motion.g>
            {/* Upper lip */}
            <path
              d="M92 157 Q101 153 110 155 Q119 153 128 157"
              stroke={lipColor}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            {/* Mouth opening */}
            {mouthOpen > 0.05 && (
              <ellipse
                cx="110"
                cy={mouthY}
                rx="16"
                ry={mouthHeight / 2}
                fill="#8B3A3A"
                opacity="0.9"
              />
            )}
            {/* Lower lip */}
            <path
              d={`M92 ${157 + mouthHeight * 0.3} Q110 ${165 + mouthHeight * 0.5} 128 ${157 + mouthHeight * 0.3}`}
              stroke={lipColor}
              strokeWidth="2.5"
              fill={mouthOpen > 0.05 ? "none" : lipColor}
              strokeLinecap="round"
            />
          </motion.g>

          {/* Connecting pulse ring */}
          {isConnecting && (
            <motion.circle
              cx="110"
              cy="118"
              r="72"
              stroke="#7BB8E8"
              strokeWidth="3"
              fill="none"
              animate={{ scale: [1, 1.08, 1], opacity: [0.7, 0.2, 0.7] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </svg>
      </motion.div>
    </div>
  );
}
