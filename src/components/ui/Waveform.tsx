interface WaveformProps {
  data?: number[];
  height?: number;
  color?: string;
  animate?: boolean;
  barWidth?: number;
  gap?: number;
}

/**
 * The signature motif: every recorded call becomes a waveform.
 * Static bars represent a finished recording; `animate` renders a gentle
 * looping pulse for calls that are live right now.
 */
export function Waveform({
  data,
  height = 36,
  color = "var(--brand)",
  animate = false,
  barWidth = 3,
  gap = 2,
}: WaveformProps) {
  const bars = data ?? Array.from({ length: 24 }, (_, i) => 0.3 + ((i * 37) % 70) / 100);
  const width = bars.length * (barWidth + gap);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={animate ? "Live call in progress" : "Call recording waveform"}
    >
      {bars.map((v, i) => {
        const barHeight = Math.max(2, v * height);
        const y = (height - barHeight) / 2;
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={barWidth / 2}
            fill={color}
            opacity={animate ? 0.55 : 0.85}
          >
            {animate && (
              <animate
                attributeName="height"
                values={`${barHeight};${Math.max(2, barHeight * 0.35)};${barHeight}`}
                dur={`${0.6 + (i % 5) * 0.15}s`}
                repeatCount="indefinite"
              />
            )}
            {animate && (
              <animate attributeName="y" values={`${y};${(height - barHeight * 0.35) / 2};${y}`} dur={`${0.6 + (i % 5) * 0.15}s`} repeatCount="indefinite" />
            )}
          </rect>
        );
      })}
    </svg>
  );
}
