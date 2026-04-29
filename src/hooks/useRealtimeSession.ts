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
  connect: (accent?: string) => Promise<void>;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
}

export function useRealtimeSession(): UseRealtimeSessionReturn {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [isPaused, setIsPaused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [amplitude, setAmplitude] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isPausedRef = useRef(false);
  // Ref mirrors status so disconnect→connect can run in the same call stack
  const statusRef = useRef<SessionStatus>("idle");
  // True after response.audio.done — we wait for actual silence before unmuting
  const waitingToUnmuteRef = useRef(false);

  const updateStatus = useCallback((s: SessionStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

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

      // Unmute mic only after AI audio has actually gone silent in the browser
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

  const handleEvent = useCallback((raw: string) => {
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
        // Don't unmute immediately — browser buffer still has audio playing.
        // The amplitude loop detects actual silence and then unmutes.
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
  }, [updateStatus]);

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

  const connect = useCallback(async (accent = "american") => {
    // Use ref so this works even right after disconnect() in the same call stack
    if (statusRef.current !== "idle") return;
    updateStatus("connecting");

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accent }),
      });
      if (!res.ok) throw new Error("Failed to get session token");
      const { token } = await res.json();

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
  }, [handleEvent, startAmplitudeLoop, disconnect, updateStatus]);

  useEffect(() => {
    return () => {
      stopAmplitudeLoop();
    };
  }, [stopAmplitudeLoop]);

  return { status, isPaused, messages, amplitude, connect, disconnect, pause, resume };
}
