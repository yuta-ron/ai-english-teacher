"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SessionStatus = "idle" | "connecting" | "listening" | "speaking";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  translation?: string;
  correction?: string;
}

interface UseRealtimeSessionReturn {
  status: SessionStatus;
  isPaused: boolean;
  messages: Message[];
  amplitude: number;
  remainingSeconds: number;
  connect: (accent?: string, paymentToken?: string) => Promise<void>;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
}

const SESSION_TOKEN_KEY = "ai_session_token";
const SESSION_EXP_KEY = "ai_session_exp";

function parseJwtExp(token: string): number {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(b64)) as { exp: number }).exp;
  } catch {
    return 0;
  }
}

export function useRealtimeSession(): UseRealtimeSessionReturn {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [isPaused, setIsPaused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [amplitude, setAmplitude] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isPausedRef = useRef(false);
  const statusRef = useRef<SessionStatus>("idle");
  const waitingToUnmuteRef = useRef(false);
  const sessionTokenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateStatus = useCallback((s: SessionStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (exp: number) => {
      stopTimer();
      timerRef.current = setInterval(() => {
        const remaining = exp - Math.floor(Date.now() / 1000);
        if (remaining <= 0) {
          setRemainingSeconds(0);
          stopTimer();
          setSessionExpired(true);
          localStorage.removeItem(SESSION_TOKEN_KEY);
          localStorage.removeItem(SESSION_EXP_KEY);
          sessionTokenRef.current = null;
        } else {
          setRemainingSeconds(remaining);
        }
      }, 500);
    },
    [stopTimer]
  );

  // Load session token from localStorage on init
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_TOKEN_KEY);
    const exp = Number(localStorage.getItem(SESSION_EXP_KEY) || 0);
    if (stored && exp > Math.floor(Date.now() / 1000)) {
      sessionTokenRef.current = stored;
      setRemainingSeconds(exp - Math.floor(Date.now() / 1000));
      startTimer(exp);
    }
  }, [startTimer]);

  const stopAmplitudeLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startAmplitudeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let max = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128);
        if (v > max) max = v;
      }
      const amp = max / 128;
      setAmplitude(amp);

      if (waitingToUnmuteRef.current && amp < 0.03) {
        waitingToUnmuteRef.current = false;
        if (!isPausedRef.current) {
          localStreamRef.current?.getAudioTracks().forEach((t) => {
            t.enabled = true;
          });
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleEvent = useCallback(
    (raw: string) => {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }

      switch (event.type) {
        case "session.created":
          updateStatus("listening");
          break;

        case "input_audio_buffer.speech_started":
          updateStatus("listening");
          break;

        case "response.audio.started":
          localStreamRef.current?.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
          updateStatus("speaking");
          break;

        case "response.audio.done":
          waitingToUnmuteRef.current = true;
          updateStatus("listening");
          break;

        case "conversation.item.input_audio_transcription.completed": {
          const transcript = event.transcript as string;
          if (!transcript?.trim()) break;
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "user", text: transcript.trim() },
          ]);
          break;
        }

        case "response.audio_transcript.done": {
          const transcript = event.transcript as string;
          if (!transcript?.trim()) break;

          const correctionMatch = transcript.match(
            /[Qq]uick tip[:\s]+[""]?(.+?)[""]?(?:\.|$)/
          );
          const correction = correctionMatch
            ? correctionMatch[1].trim()
            : undefined;

          const cleanText = transcript
            .replace(/[Qq]uick tip[:\s]+[""]?.+?[""]?\.?\s*$/, "")
            .trim();

          const id = crypto.randomUUID();
          setMessages((prev) => [
            ...prev,
            { id, role: "assistant", text: cleanText, correction },
          ]);

          fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleanText }),
          })
            .then((r) => r.json())
            .then(({ translation }: { translation: string }) => {
              if (translation) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, translation } : m))
                );
              }
            })
            .catch(() => {});

          break;
        }
      }
    },
    [updateStatus]
  );

  const pause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
  }, []);

  const disconnect = useCallback(() => {
    stopAmplitudeLoop();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    dcRef.current?.close();
    pcRef.current?.close();
    audioCtxRef.current?.close();
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    pcRef.current = null;
    dcRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current = null;
    isPausedRef.current = false;
    waitingToUnmuteRef.current = false;
    setIsPaused(false);
    updateStatus("idle");
    setAmplitude(0);
  }, [stopAmplitudeLoop, updateStatus]);

  // Handle session expiry (triggered from timer)
  useEffect(() => {
    if (sessionExpired) {
      disconnect();
      setSessionExpired(false);
    }
  }, [sessionExpired, disconnect]);

  const connect = useCallback(
    async (accent = "american", paymentToken?: string) => {
      if (statusRef.current !== "idle") return;
      updateStatus("connecting");

      const body: Record<string, string> = { accent };
      if (paymentToken) {
        body.paymentToken = paymentToken;
      } else if (sessionTokenRef.current) {
        body.sessionToken = sessionTokenRef.current;
      } else {
        updateStatus("idle");
        return;
      }

      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to get session token");
        const data = await res.json();
        const { token, sessionToken: newSessionToken, sessionExp } = data;

        if (newSessionToken && sessionExp) {
          sessionTokenRef.current = newSessionToken;
          localStorage.setItem(SESSION_TOKEN_KEY, newSessionToken);
          localStorage.setItem(SESSION_EXP_KEY, String(sessionExp));
          setRemainingSeconds(sessionExp - Math.floor(Date.now() / 1000));
          startTimer(sessionExp);
        }

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.autoplay = true;
        }

        pc.ontrack = (e) => {
          const stream = e.streams[0];
          audioRef.current!.srcObject = stream;

          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
          startAmplitudeLoop();
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (e) => handleEvent(e.data);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpRes = await fetch(
          `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp,
          }
        );

        if (!sdpRes.ok) throw new Error("Failed to connect to OpenAI Realtime");
        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (err) {
        console.error(err);
        disconnect();
      }
    },
    [handleEvent, startAmplitudeLoop, disconnect, updateStatus, startTimer]
  );

  useEffect(() => {
    return () => {
      stopAmplitudeLoop();
      stopTimer();
    };
  }, [stopAmplitudeLoop, stopTimer]);

  return {
    status,
    isPaused,
    messages,
    amplitude,
    remainingSeconds,
    connect,
    disconnect,
    pause,
    resume,
  };
}

export { parseJwtExp };
