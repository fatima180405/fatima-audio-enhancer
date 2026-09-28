import React, { useEffect, useRef, useState } from 'react';
import { X, Scissors, Play, Pause, Volume2, Check, RefreshCw, Sparkles, ShieldCheck, Gauge, Clock } from 'lucide-react';
import { ConversionSettings } from '../types';
import { formatDuration } from '../utils/formatters';

interface AudioTrimModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBuffer: AudioBuffer | null;
  settings: ConversionSettings;
  onSaveSettings: (newSettings: Partial<ConversionSettings>) => void;
  fileName: string;
}

export const AudioTrimModal: React.FC<AudioTrimModalProps> = ({
  isOpen,
  onClose,
  audioBuffer,
  settings,
  onSaveSettings,
  fileName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const duration = audioBuffer?.duration || 0;

  const [startTime, setStartTime] = useState<number>(settings.startTime || 0);
  const [endTime, setEndTime] = useState<number>(settings.endTime || duration);
  const [volume, setVolume] = useState<number>(settings.volume || 1.0);
  const [speed, setSpeed] = useState<number>(settings.speed || 1.0);
  const [preservePitch, setPreservePitch] = useState<boolean>(settings.preservePitch !== false);
  const [fadeIn, setFadeIn] = useState<number>(settings.fadeInSeconds || 0);
  const [fadeOut, setFadeOut] = useState<number>(settings.fadeOutSeconds || 0);
  const [padSilenceEnd, setPadSilenceEnd] = useState<number>(settings.padSilenceEnd || 0);
  const [clarityEnhancer, setClarityEnhancer] = useState<boolean>(settings.clarityEnhancer !== false);
  const [antiClippingLimiter, setAntiClippingLimiter] = useState<boolean>(settings.antiClippingLimiter !== false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (audioBuffer) {
      setStartTime(settings.startTime || 0);
      setEndTime(settings.endTime > 0 ? settings.endTime : audioBuffer.duration);
      setVolume(settings.volume || 1.0);
      setSpeed(settings.speed || 1.0);
      setPreservePitch(settings.preservePitch !== false);
      setFadeIn(settings.fadeInSeconds || 0);
      setFadeOut(settings.fadeOutSeconds || 0);
      setPadSilenceEnd(settings.padSilenceEnd || 0);
      setClarityEnhancer(settings.clarityEnhancer !== false);
      setAntiClippingLimiter(settings.antiClippingLimiter !== false);
    }
  }, [audioBuffer, settings]);

  // Draw Waveform
  useEffect(() => {
    if (!isOpen || !audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw background waveform
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Draw active trim highlight selection
    const startX = (startTime / duration) * width;
    const endX = (endTime / duration) * width;

    ctx.fillStyle = 'rgba(79, 70, 229, 0.2)';
    ctx.fillRect(startX, 0, Math.max(0, endX - startX), height);

    ctx.fillStyle = '#4f46e5';
    for (let i = Math.floor(startX); i < Math.min(width, Math.ceil(endX)); i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Start & End markers
    ctx.strokeStyle = '#4338ca';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();
  }, [isOpen, audioBuffer, startTime, endTime, duration]);

  // Clean up audio playback on unmount or stop
  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!audioBuffer) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContextClass();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = speed;

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    const playDuration = Math.max(0.1, endTime - startTime);
    source.start(0, startTime, playDuration);
    sourceNodeRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      sourceNodeRef.current = null;
    };
  };

  const handleSave = () => {
    stopPlayback();
    onSaveSettings({
      startTime,
      endTime: endTime >= duration ? 0 : endTime,
      volume,
      speed,
      preservePitch,
      fadeInSeconds: fadeIn,
      fadeOutSeconds: fadeOut,
      padSilenceEnd,
      padSilenceStart: settings.padSilenceStart || 0,
      clarityEnhancer,
      antiClippingLimiter,
    });
    onClose();
  };

  const handleReset = () => {
    setStartTime(0);
    setEndTime(duration);
    setVolume(1.0);
    setSpeed(1.0);
    setPreservePitch(true);
    setFadeIn(0);
    setFadeOut(0);
    setPadSilenceEnd(0);
    setClarityEnhancer(true);
    setAntiClippingLimiter(true);
  };

  if (!isOpen) return null;

  const currentTrimmedDuration = Math.max(0, endTime - startTime);
  const effectiveOutputDuration = speed > 0 ? currentTrimmedDuration / speed : currentTrimmedDuration;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
            <Scissors className="w-5 h-5 text-indigo-600" />
            <span>Cắt Nhạc, Tốc Độ & Tăng Âm Lượng</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopPlayback();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 truncate font-medium">
          File: <strong className="text-slate-700">{fileName}</strong> ({formatDuration(duration)})
        </p>

        {/* Waveform Canvas */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 relative">
          <canvas
            ref={canvasRef}
            width={500}
            height={80}
            className="w-full h-20 rounded bg-white shadow-2xs border border-slate-100"
          />

          <div className="flex items-center justify-between mt-2 text-xs font-mono font-semibold text-slate-600">
            <span>Bắt đầu: {formatDuration(startTime)}</span>
            <span className="text-indigo-600">
              Đoạn chọn: {formatDuration(currentTrimmedDuration)}
              {speed !== 1.0 && (
                <span className="text-sky-600 font-bold ml-1.5">
                  → Sau đổi tốc ({speed}x): {formatDuration(effectiveOutputDuration)}
                </span>
              )}
            </span>
            <span>Kết thúc: {formatDuration(endTime)}</span>
          </div>
        </div>

        {/* Sliders & Settings */}
        <div className="space-y-4 mb-5">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Thời điểm bắt đầu (s)</span>
              <span className="font-mono text-indigo-600">{startTime.toFixed(1)}s ({formatDuration(startTime)})</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, endTime - 0.5)}
              step={0.1}
              value={startTime}
              onChange={(e) => setStartTime(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Thời điểm kết thúc (s)</span>
              <span className="font-mono text-indigo-600">{endTime.toFixed(1)}s ({formatDuration(endTime)})</span>
            </div>
            <input
              type="range"
              min={startTime + 0.5}
              max={duration}
              step={0.1}
              value={endTime}
              onChange={(e) => setEndTime(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
          </div>

          {/* Speed / Tempo Adjustment (Chỉnh Tốc Độ - Hỗ trợ IELTS Listening) */}
          <div className="space-y-2.5 p-3.5 bg-sky-50/80 rounded-xl border border-sky-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5 font-bold text-sky-900">
                <Gauge className="w-4 h-4 text-sky-600" /> Tốc Độ Âm Thanh (Luyện Nghe IELTS / Ngoại ngữ)
              </span>
              <span className="font-mono text-sky-950 font-bold bg-sky-200/90 px-2 py-0.5 rounded-md text-xs">
                {speed.toFixed(2)}x
                {speed < 1.0 ? ` (Chậm hơn ${Math.round((1 - speed) * 100)}%)` : speed > 1.0 ? ` (Nhanh hơn ${Math.round((speed - 1) * 100)}%)` : ' (Gốc 1.0x)'}
              </span>
            </div>
            
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.01}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer h-2 bg-sky-200/80 rounded-lg"
            />

            {/* Quick Speed Presets for IELTS / Exam / Language Listening */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-sky-900 font-semibold">Gợi ý tốc độ:</span>
              {[
                { val: 0.50, label: '0.50x (Rất chậm)', highlight: true },
                { val: 0.60, label: '0.60x' },
                { val: 0.70, label: '0.70x (Chậm)', highlight: true },
                { val: 0.75, label: '0.75x' },
                { val: 0.80, label: '0.80x' },
                { val: 0.85, label: '0.85x (IELTS êm)', highlight: true },
                { val: 0.90, label: '0.90x (IELTS chuẩn)', highlight: true },
                { val: 0.95, label: '0.95x (Tự nhiên)' },
                { val: 1.00, label: '1.00x (Gốc)' },
                { val: 1.10, label: '1.10x' },
                { val: 1.25, label: '1.25x' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setSpeed(p.val)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    Math.abs(speed - p.val) < 0.005
                      ? 'bg-sky-600 text-white shadow-xs'
                      : p.highlight
                      ? 'bg-white border border-sky-300 text-sky-900 hover:bg-sky-100 font-bold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Preserve Pitch Checkbox */}
            <label className="flex items-center justify-between pt-1 border-t border-sky-200/60 cursor-pointer">
              <span className="text-[11px] text-sky-900 font-medium">
                Giữ nguyên cao độ giọng nói (SOLA - Không bị ồm hay biến đổi giọng khi giảm tốc)
              </span>
              <input
                type="checkbox"
                checked={preservePitch}
                onChange={(e) => setPreservePitch(e.target.checked)}
                className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Volume Booster */}
          <div className="space-y-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                <span className="flex items-center gap-1.5 font-bold text-amber-800">
                  <Volume2 className="w-4 h-4 text-amber-600" /> Tăng Âm Lượng (Volume Booster)
                </span>
                <span className="font-mono text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded-md text-xs">
                  {Math.round(volume * 100)}%
                  {volume > 1.0 ? ` (+${(20 * Math.log10(volume)).toFixed(1)} dB)` : ''}
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={4.0}
                step={0.1}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer h-2 bg-amber-200/70 rounded-lg"
              />

              {/* Volume Quick Presets */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">Nhanh:</span>
                {[
                  { val: 1.0, label: '100% (Gốc)' },
                  { val: 1.5, label: '150% (+3.5dB)' },
                  { val: 2.0, label: '200% (+6dB)' },
                  { val: 3.0, label: '300% (+9.5dB)' },
                  { val: 4.0, label: '400% (+12dB)' },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setVolume(p.val)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                      volume === p.val
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Clarity & Anti-Clipping Switches */}
            <div className="pt-2 border-t border-amber-200/60 space-y-2">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Làm trong âm thanh (Khử ù & tăng độ rõ tiếng)</span>
                </span>
                <input
                  type="checkbox"
                  checked={clarityEnhancer}
                  onChange={(e) => setClarityEnhancer(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Chống rè / vỡ tiếng (Soft-knee limiter)</span>
                </span>
                <input
                  type="checkbox"
                  checked={antiClippingLimiter}
                  onChange={(e) => setAntiClippingLimiter(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fade In (s)</label>
                <select
                  value={fadeIn}
                  onChange={(e) => setFadeIn(parseInt(e.target.value, 10))}
                  className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white"
                >
                  <option value={0}>Tắt</option>
                  <option value={1}>1 giây</option>
                  <option value={2}>2 giây</option>
                  <option value={3}>3 giây</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fade Out (s)</label>
                <select
                  value={fadeOut}
                  onChange={(e) => setFadeOut(parseInt(e.target.value, 10))}
                  className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white"
                >
                  <option value={0}>Tắt</option>
                  <option value={1}>1 giây</option>
                  <option value={2}>2 giây</option>
                  <option value={3}>3 giây</option>
                </select>
              </div>
            </div>
          </div>

          {/* Silence Gap Padding (Khoảng lặng chèn thêm) */}
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Khoảng lặng chèn sau file (IELTS / Đọc câu hỏi):
              </label>
              <span className="text-xs font-bold text-indigo-700">
                {padSilenceEnd > 0 ? `+${padSilenceEnd} giây` : '0s (Không thêm)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={[0, 5, 10, 15, 20, 30, 45, 60, 90, 120].includes(padSilenceEnd) ? padSilenceEnd : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setPadSilenceEnd(parseFloat(e.target.value));
                  }
                }}
                className="flex-1 p-2 rounded-lg border border-indigo-200 bg-white text-xs font-bold text-slate-800 cursor-pointer"
              >
                <option value={0}>0s (Không thêm khoảng lặng)</option>
                <option value={5}>5 giây</option>
                <option value={10}>10 giây</option>
                <option value={15}>15 giây (IELTS - Luyện nghe)</option>
                <option value={30}>30 giây (IELTS - Nghỉ đọc đề)</option>
                <option value={45}>45 giây (Chuẩn bị Part)</option>
                <option value={60}>60 giây (1 phút)</option>
                <option value={90}>90 giây (1.5 phút)</option>
                <option value={120}>120 giây (2 phút)</option>
                <option value="custom">✏️ Nhập số giây tùy ý ({padSilenceEnd}s)...</option>
              </select>

              <div className="relative w-24 shrink-0">
                <input
                  type="number"
                  min="0"
                  max="3600"
                  step="any"
                  value={padSilenceEnd}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setPadSilenceEnd(!isNaN(v) ? Math.max(0, v) : 0);
                  }}
                  className="w-full pl-2 pr-7 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 text-center"
                  placeholder="0"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                  s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-amber-600" /> : <Play className="w-4 h-4 text-indigo-600" />}
              {isPlaying ? 'Dừng phát' : `Nghe thử (${speed.toFixed(2)}x)`}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              title="Đặt lại toàn bộ"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopPlayback();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Áp Dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
