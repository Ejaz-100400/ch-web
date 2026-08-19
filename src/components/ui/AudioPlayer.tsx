import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Download, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({ src, downloadFileName }: { src: string; downloadFileName?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (!scrubbing) setCurrentTime(audio.currentTime);
    };
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => setPlaying(false);
    const onProgress = () => {
      if (audio.buffered.length > 0) setBuffered(audio.buffered.end(audio.buffered.length - 1));
    };
    const onError = () => setErrored(true);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("progress", onProgress);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("progress", onProgress);
      audio.removeEventListener("error", onError);
    };
  }, [scrubbing]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => setErrored(true));
    setPlaying(!playing);
  }

  function seekToClientX(clientX: number) {
    const audio = audioRef.current;
    const bar = barRef.current;
    if (!audio || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = ratio * duration;
    audio.currentTime = t;
    setCurrentTime(t);
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    setScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (scrubbing) seekToClientX(e.clientX);
  }
  function handlePointerUp() {
    setScrubbing(false);
  }

  function skip(delta: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Math.max(0, Math.min(duration, audio.currentTime + delta));
    audio.currentTime = t;
    setCurrentTime(t);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    setMuted(next);
  }

  function changeVolume(v: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = v;
    setVolume(v);
    const shouldMute = v === 0;
    audio.muted = shouldMute;
    setMuted(shouldMute);
  }

  function cycleSpeed() {
    const audio = audioRef.current;
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio) audio.playbackRate = next;
  }

  if (errored) {
    return <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Couldn't play this recording -- try refreshing the page.</p>;
  }

  const playedRatio = duration > 0 ? currentTime / duration : 0;
  const bufferedRatio = duration > 0 ? buffered / duration : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} style={playButtonStyle}>
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 1 }} />}
        </button>
        <button onClick={() => skip(-10)} aria-label="Back 10 seconds" title="Back 10s" style={iconButtonStyle}>
          <RotateCcw size={14} />
        </button>
        <button onClick={() => skip(10)} aria-label="Forward 10 seconds" title="Forward 10s" style={iconButtonStyle}>
          <RotateCw size={14} />
        </button>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--text-soft)", whiteSpace: "nowrap" }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button onClick={cycleSpeed} title="Playback speed" style={{ ...iconButtonStyle, width: "auto", padding: "0 8px", marginLeft: "auto", fontSize: 11.5, fontWeight: 700 }}>
          {speed}x
        </button>
      </div>

      <div
        ref={barRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") skip(5);
          if (e.key === "ArrowLeft") skip(-5);
        }}
        style={{ position: "relative", height: 16, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}
      >
        <div style={{ position: "relative", width: "100%", height: 5, borderRadius: 999, background: "var(--border)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${bufferedRatio * 100}%`, borderRadius: 999, background: "var(--border-strong)" }} />
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${playedRatio * 100}%`, borderRadius: 999, background: "var(--brand)" }} />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${playedRatio * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--brand)",
              boxShadow: "0 0 0 2px var(--paper-raised)",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} style={iconButtonStyle}>
          {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          aria-label="Volume"
          style={{ width: 64 }}
        />
        <a href={src} download={downloadFileName} aria-label="Download recording" title="Download" style={{ ...iconButtonStyle, marginLeft: "auto", textDecoration: "none" }}>
          <Download size={14} />
        </a>
      </div>
    </div>
  );
}

const playButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: "50%",
  border: "none",
  background: "var(--brand)",
  color: "var(--on-brand)",
  cursor: "pointer",
} as const;

const iconButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  flexShrink: 0,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--paper-raised)",
  color: "var(--text-soft)",
  cursor: "pointer",
} as const;
