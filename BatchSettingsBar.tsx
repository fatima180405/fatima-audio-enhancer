import React from 'react';
import {
  Sliders,
  Play,
  Download,
  Trash2,
  CheckCircle,
  Archive,
  RefreshCw,
  Sparkles,
  Layers,
  ShieldCheck,
  Gauge,
} from 'lucide-react';
import { BitrateOption, ChannelOption, SampleRateOption } from '../types';

interface BatchSettingsBarProps {
  totalCount: number;
  completedCount: number;
  isConvertingAny: boolean;
  globalBitrate: BitrateOption;
  globalSampleRate: SampleRateOption;
  globalChannels: ChannelOption;
  globalVolume: number;
  globalSpeed: number;
  globalClarityEnhancer: boolean;
  globalAntiClippingLimiter: boolean;
  onBitrateChange: (bitrate: BitrateOption) => void;
  onSampleRateChange: (sampleRate: SampleRateOption) => void;
  onChannelsChange: (channels: ChannelOption) => void;
  onVolumeChange: (volume: number) => void;
  onSpeedChange: (speed: number) => void;
  onClarityChange: (clarity: boolean) => void;
  onLimiterChange: (limiter: boolean) => void;
  onOpenMerger: () => void;
  onConvertAll: () => void;
  onDownloadZip: () => void;
  onClearAll: () => void;
}

export const BatchSettingsBar: React.FC<BatchSettingsBarProps> = ({
  totalCount,
  completedCount,
  isConvertingAny,
  globalBitrate,
  globalSampleRate,
  globalChannels,
  globalVolume,
  globalSpeed,
  globalClarityEnhancer,
  globalAntiClippingLimiter,
  onBitrateChange,
  onSampleRateChange,
  onChannelsChange,
  onVolumeChange,
  onSpeedChange,
  onClarityChange,
  onLimiterChange,
  onOpenMerger,
  onConvertAll,
  onDownloadZip,
  onClearAll,
}) => {
  return (
    <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Global Options */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400 mr-1">
            <Sliders className="w-4 h-4" />
            <span>Cấu Hình Hàng Loạt ({totalCount} File)</span>
          </div>

          {/* Quality / Bitrate */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-xs font-medium text-slate-400">Chất lượng:</span>
            <select
              value={globalBitrate}
              onChange={(e) => onBitrateChange(parseInt(e.target.value, 10) as BitrateOption)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value={320} className="bg-slate-800 text-white">320 Kbps (Cao nhất)</option>
              <option value={256} className="bg-slate-800 text-white">256 Kbps</option>
              <option value={192} className="bg-slate-800 text-white">192 Kbps (Chuẩn)</option>
              <option value={128} className="bg-slate-800 text-white">128 Kbps (Nhẹ)</option>
              <option value={64} className="bg-slate-800 text-white">64 Kbps</option>
            </select>
          </div>

          {/* Speed Selector (Tốc Độ Phát IELTS / Học tập) */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-sky-600/40">
            <span className="text-xs font-medium text-sky-400 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-sky-400" /> Tốc độ:
            </span>
            <select
              value={globalSpeed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              className="bg-transparent text-xs font-bold text-sky-300 focus:outline-none cursor-pointer"
            >
              <option value={0.50} className="bg-slate-800 text-sky-300 font-bold">0.50x (Rất chậm - 50%)</option>
              <option value={0.60} className="bg-slate-800 text-white">0.60x</option>
              <option value={0.70} className="bg-slate-800 text-white">0.70x (Chậm)</option>
              <option value={0.75} className="bg-slate-800 text-white">0.75x</option>
              <option value={0.80} className="bg-slate-800 text-white">0.80x</option>
              <option value={0.85} className="bg-slate-800 text-sky-300 font-bold">0.85x (IELTS êm)</option>
              <option value={0.90} className="bg-slate-800 text-sky-300 font-bold">0.90x (IELTS chuẩn)</option>
              <option value={0.95} className="bg-slate-800 text-white">0.95x (Tự nhiên)</option>
              <option value={1.00} className="bg-slate-800 text-white">1.00x (Gốc chuẩn)</option>
              <option value={1.05} className="bg-slate-800 text-white">1.05x</option>
              <option value={1.10} className="bg-slate-800 text-white">1.10x</option>
              <option value={1.25} className="bg-slate-800 text-white">1.25x</option>
              <option value={1.50} className="bg-slate-800 text-white">1.50x (Nhanh)</option>
            </select>
          </div>

          {/* Volume Boost */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-xs font-medium text-amber-400">🔊 Âm lượng:</span>
            <select
              value={globalVolume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
            >
              <option value={1.0} className="bg-slate-800 text-white">100% (Mặc định)</option>
              <option value={1.25} className="bg-slate-800 text-white">125% (+2 dB)</option>
              <option value={1.5} className="bg-slate-800 text-white">150% (+3.5 dB)</option>
              <option value={2.0} className="bg-slate-800 text-white">200% (+6 dB)</option>
              <option value={3.0} className="bg-slate-800 text-white">300% (+9.5 dB)</option>
              <option value={4.0} className="bg-slate-800 text-white">400% (+12 dB)</option>
            </select>
          </div>

          {/* Sample Rate */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-xs font-medium text-slate-400">Tần số:</span>
            <select
              value={globalSampleRate}
              onChange={(e) => onSampleRateChange(parseInt(e.target.value, 10) as SampleRateOption)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-slate-800 text-white">Tự động (Gốc)</option>
              <option value={48000} className="bg-slate-800 text-white">48 kHz</option>
              <option value={44100} className="bg-slate-800 text-white">44.1 kHz</option>
              <option value={32000} className="bg-slate-800 text-white">32 kHz</option>
              <option value={22050} className="bg-slate-800 text-white">22.05 kHz</option>
            </select>
          </div>

          {/* Toggle: Audio Clarity Enhancer */}
          <button
            type="button"
            onClick={() => onClarityChange(!globalClarityEnhancer)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              globalClarityEnhancer
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Lọc ù âm trầm & tăng độ trong sáng rõ lời cho giọng nói"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Làm Trong Âm Thanh ({globalClarityEnhancer ? 'BẬT' : 'TẮT'})</span>
          </button>

          {/* Toggle: Anti-Clipping Soft Limiter */}
          <button
            type="button"
            onClick={() => onLimiterChange(!globalAntiClippingLimiter)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              globalAntiClippingLimiter
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Khử rè & vỡ tiếng bằng thuật toán nén mềm limiter khi tăng âm lượng"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chống Rè ({globalAntiClippingLimiter ? 'BẬT' : 'TẮT'})</span>
          </button>
        </div>

        {/* Right: Master Buttons */}
        <div className="flex items-center gap-2 self-end lg:self-auto flex-wrap">
          {totalCount >= 1 && (
            <button
              type="button"
              onClick={onOpenMerger}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-md shadow-purple-900/40 flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              Gộp File Audio thành 1 MP3
            </button>
          )}

          {completedCount > 0 && (
            <button
              type="button"
              onClick={onDownloadZip}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              Tải Tất Cả dạng .ZIP ({completedCount})
            </button>
          )}

          <button
            type="button"
            disabled={isConvertingAny}
            onClick={onConvertAll}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-900/40 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isConvertingAny ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Đang Chuyển Đổi...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Chuyển Đổi Tất Cả MP3
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClearAll}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Xóa danh sách"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
