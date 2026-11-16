import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

export function usePreviewPlayback(duration = 30) {
  const [playing, setPlaying] = useState(true);
  const timeRef = useRef(0);
  const listeners = useRef(new Set());
  const subscribe = useCallback(listener => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);
  const getTime = useCallback(() => timeRef.current, []);
  const seek = useCallback(value => {
    timeRef.current = Math.min(duration, Math.max(0, value));
    listeners.current.forEach(listener => listener());
  }, [duration]);

  useEffect(() => {
    if (!playing) return;
    let frame;
    let last = performance.now();
    const tick = now => {
      const delta = (now - last) / 1000;
      last = now;
      seek((timeRef.current + delta) % duration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, seek]);

  return { playing, timeRef, getTime, subscribe, seek, duration, toggle: () => setPlaying(value => !value) };
}

function formatTime(seconds) {
  const centiseconds = Math.round(seconds * 100);
  const minutes = String(Math.floor(centiseconds / 6000)).padStart(2, '0');
  const remainder = ((centiseconds % 6000) / 100).toFixed(2).padStart(5, '0');
  return minutes + ':' + remainder;
}

export function PreviewTimeline({ playback, className = '' }) {
  const time = useSyncExternalStore(playback.subscribe, playback.getTime);
  const value = Math.round(time * 100) / 100;
  return (
    <div className={`timeline nodrag nopan nowheel ${className}`}>
      <Button className="play-btn" size="icon" aria-label={playback.playing ? 'Pause preview' : 'Play preview'} onClick={playback.toggle}>
        {playback.playing ? <Pause size={14} /> : <Play size={14} />}
      </Button>
      <span>{formatTime(time)}</span>
      <Slider className="timeline-slider" thumbLabel="Preview time" min={0} max={playback.duration} step={0.01}
        value={[value]} onValueChange={([next]) => playback.seek(next)} />
      <span>{formatTime(playback.duration)}</span>
    </div>
  );
}
