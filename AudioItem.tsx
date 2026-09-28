import React, { useState } from 'react';
import {
  FileAudio,
  Play,
  Pause,
  Download,
  Scissors,
  Tag,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Music3,
  Sliders,
  Volume2,
  Zap,
  Gauge,
  Clock,
} from 'lucide-react';
import { AudioFileItem, BitrateOption, ConversionSettings, ID3Tags } from '../types';
import { formatDuration, formatFileSize, getFileExtension } from '../utils/formatters';
import { AudioTrimModal } from './AudioTrimModal';
import { TagEditModal } from './TagEditModal';
import { SingleAudioSilenceModal } from './SingleAudioSilenceModal';

interface AudioItemProps {
  item: AudioFileItem;
  onConvert: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateSettings: (id: string, settings: Partial<ConversionSettings>) => void;
  onUpdateTags: (id: string, tags: ID3Tags) => void;
  onOpenSplitter?: (item: AudioFileItem) => void;
  onApplyAllSilence?: (settings: Partial<ConversionSettings>) => void;
}

export const AudioItem: React.FC<AudioItemProps> = ({
  item,
  onConvert,
  onRemove,
  onUpdateSettings,
  onUpdateTags,
  onOpenSplitter,
  onApplyAllSilence,
}) => {
  const [isTrimModalOpen, setIsTrimModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isSilenceModalOpen, setIsSilenceModalOpen] = useState(false);
  const [isPlayingConverted, setIsPlayingConverted] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const ext = getFileExtension(item.name);

  // Check if trim or gain custom settings exist
  const isCustomized =
    item.settings.startTime > 0 ||
    (item.settings.endTime > 0 && item.settings.endTime < item.duration) ||
    item.settings.volume !== 1.0 ||
    (item.settings.speed && item.settings.speed !== 1.0) ||
    item.settings.fadeInSeconds > 0 ||
    item.settings.fadeOutSeconds > 0;

  const handleTogglePlayConverted = () => {
    if (!item.convertedUrl) return;

    if (isPlayingConverted && audioElement) {
      audioElement.pause();
      setIsPlayingConverted(false);
      return;
    }

    const audio = new Audio(item.convertedUrl);
    setAudioElement(audio);
    audio.play();
    setIsPlayingConverted(true);

    audio.onended = () => {
      setIsPlayingConverted(false);
    };
  };

  const handleDownload = () => {
    if (!item.convertedUrl) return;
    const a = document.createElement('a');
    a.href = item.convertedUrl;
    // Replace original extension with .mp3
    const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
    a.download = `${baseName}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* File Info */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
            <FileAudio className="w-6 h-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-xs sm:max-w-md" title={item.name}>
                {item.name}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                {ext}
              </span>
              {item.settings.speed && item.settings.speed !== 1.0 && (
                <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-sky-600" />
                  {item.settings.speed}x Tốc độ
                </span>
              )}
              {item.settings.volume && item.settings.volume > 1.0 && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-emerald-600" />
                  +{Math.round(item.settings.volume * 100)}% Âm lượng
                </span>
              )}
              {isCustomized && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1">
                  <Scissors className="w-3 h-3" /> Đã tùy chỉnh
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
              <span>Dung lượng gốc: <strong className="text-slate-700">{formatFileSize(item.originalSize)}</strong></span>
              <span>•</span>
              <span>Thời lượng: <strong className="text-slate-700">{formatDuration(item.duration)}</strong></span>
              {item.settings.speed && item.settings.speed !== 1.0 && (
                <>
                  <span>•</span>
                  <span>Sau đổi tốc: <strong className="text-sky-700">{formatDuration(item.duration / item.settings.speed)}</strong></span>
                </>
              )}
              {((item.settings.padSilenceEnd || 0) > 0 || (item.settings.padSilenceStart || 0) > 0) && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded text-[11px] font-bold">
                    <Clock className="w-3 h-3" />
                    +{(item.settings.padSilenceEnd || 0) + (item.settings.padSilenceStart || 0)}s khoảng trống
                  </span>
                  <span>•</span>
                  <span>Xuất file: <strong className="text-indigo-900 font-bold">{formatDuration((item.duration / (item.settings.speed || 1.0)) + (item.settings.padSilenceEnd || 0) + (item.settings.padSilenceStart || 0))}</strong></span>
                </>
              )}
              {item.audioBuffer && (
                <>
                  <span>•</span>
                  <span>{item.audioBuffer.sampleRate / 1000} kHz</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Options & Settings */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Bitrate Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 px-2">MP3:</span>
            <select
              value={item.settings.bitrate}
              disabled={item.status === 'converting' || item.status === 'decoding'}
              onChange={(e) =>
                onUpdateSettings(item.id, {
                  bitrate: parseInt(e.target.value, 10) as BitrateOption,
                })
              }
              className="bg-white text-xs font-bold text-slate-800 rounded-lg px-2 py-1 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value={320}>320 Kbps</option>
              <option value={256}>256 Kbps</option>
              <option value={192}>192 Kbps</option>
              <option value={128}>128 Kbps</option>
              <option value={64}>64 Kbps</option>
            </select>
          </div>

          {/* Speed Selector (Luyện nghe IELTS) */}
          <div className="flex items-center gap-1 bg-sky-50/80 p-1 rounded-xl border border-sky-200">
            <Gauge className="w-3.5 h-3.5 text-sky-600 ml-1.5" />
            <select
              value={item.settings.speed || 1.0}
              disabled={item.status === 'converting' || item.status === 'decoding'}
              onChange={(e) =>
                onUpdateSettings(item.id, {
                  speed: parseFloat(e.target.value),
                })
              }
              className="bg-white text-xs font-bold text-sky-900 rounded-lg px-2 py-1 border border-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              title="Chỉnh tốc độ phát âm thanh (Ví dụ 0.50x, 0.70x, 0.85x, 0.90x cho IELTS Listening)"
            >
              <option value={0.50}>0.50x (Rất chậm)</option>
              <option value={0.60}>0.60x</option>
              <option value={0.70}>0.70x (Chậm)</option>
              <option value={0.75}>0.75x</option>
              <option value={0.80}>0.80x</option>
              <option value={0.85}>0.85x (IELTS)</option>
              <option value={0.90}>0.90x (IELTS)</option>
              <option value={0.95}>0.95x</option>
              <option value={1.00}>1.00x (Gốc)</option>
              <option value={1.05}>1.05x</option>
              <option value={1.10}>1.10x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.50}>1.50x</option>
            </select>
          </div>

          {/* Volume Booster Selector */}
          <div className="flex items-center gap-1.5 bg-amber-50/70 p-1 rounded-xl border border-amber-200">
            <Volume2 className="w-3.5 h-3.5 text-amber-600 ml-1.5" />
            <select
              value={item.settings.volume || 1.0}
              disabled={item.status === 'converting' || item.status === 'decoding'}
              onChange={(e) =>
                onUpdateSettings(item.id, {
                  volume: parseFloat(e.target.value),
                })
              }
              className="bg-white text-xs font-bold text-amber-900 rounded-lg px-2 py-1 border border-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value={1.0}>Âm lượng: 100%</option>
              <option value={1.25}>Tăng 125% (+2dB)</option>
              <option value={1.5}>Tăng 150% (+3.5dB)</option>
              <option value={2.0}>Tăng 200% (+6dB)</option>
              <option value={3.0}>Tăng 300% (+9.5dB)</option>
              <option value={4.0}>Tăng 400% (+12dB)</option>
            </select>
          </div>

          {/* Audio Trimmer & Fine Speed Button */}
          <button
            type="button"
            disabled={!item.audioBuffer || item.status === 'converting'}
            onClick={() => setIsTrimModalOpen(true)}
            className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              isCustomized
                ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Cắt nhạc, chỉnh tốc độ chi tiết & tăng âm lượng"
          >
            <Scissors className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Cắt & Tốc độ</span>
          </button>

          {/* Single File Silence Gap Button */}
          <button
            type="button"
            disabled={item.status === 'converting'}
            onClick={() => setIsSilenceModalOpen(true)}
            className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              ((item.settings.padSilenceEnd || 0) > 0 || (item.settings.padSilenceStart || 0) > 0)
                ? 'bg-indigo-50 border-indigo-300 text-indigo-800 hover:bg-indigo-100 shadow-2xs font-bold'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Thêm khoảng lặng / khoảng trống sau hoặc trước file (ví dụ 15s, 30s nghỉ đọc câu hỏi IELTS)"
          >
            <Clock className={`w-3.5 h-3.5 ${((item.settings.padSilenceEnd || 0) > 0 || (item.settings.padSilenceStart || 0) > 0) ? 'text-indigo-600' : 'text-slate-500'}`} />
            <span>
              {(item.settings.padSilenceEnd || 0) > 0
                ? `+${item.settings.padSilenceEnd}s khoảng lặng`
                : (item.settings.padSilenceStart || 0) > 0
                ? `+${item.settings.padSilenceStart}s đầu`
                : 'Khoảng lặng'}
            </span>
          </button>

          {/* Smart Silence Splitter Button */}
          {onOpenSplitter && (
            <button
              type="button"
              disabled={item.status === 'converting'}
              onClick={() => onOpenSplitter(item)}
              className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
              title="Tách tự động thành các câu nhỏ dựa vào khoảng lặng"
            >
              <Zap className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">Tách câu</span>
            </button>
          )}

          {/* ID3 Tag Editor Button */}
          <button
            type="button"
            disabled={item.status === 'converting'}
            onClick={() => setIsTagModalOpen(true)}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
            title="Sửa thẻ nhạc ID3"
          >
            <Tag className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Thẻ nhạc</span>
          </button>

          {/* Remove Button */}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
            title="Xóa khỏi danh sách"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conversion Status & Action Footer Bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2 min-w-0">
          {item.status === 'idle' && (
            <span className="text-xs font-semibold text-slate-500">Sẵn sàng chuyển đổi</span>
          )}

          {item.status === 'decoding' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              <span>Đang đọc file âm thanh...</span>
            </div>
          )}

          {item.status === 'converting' && (
            <div className="flex-1 max-w-xs space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-700">
                <span>Đang mã hóa MP3 ({item.settings.bitrate}Kbps{item.settings.speed && item.settings.speed !== 1.0 ? ` • ${item.settings.speed}x` : ''})</span>
                <span>{item.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-150"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          )}

          {item.status === 'completed' && item.convertedSize && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Hoàn thành
              </span>
              <span className="text-xs font-medium text-slate-600">
                Mới: <strong className="text-slate-800">{formatFileSize(item.convertedSize)}</strong>
              </span>
              {item.convertedSize < item.originalSize && (
                <span className="text-xs font-bold text-emerald-600">
                  (-{Math.round((1 - item.convertedSize / item.originalSize) * 100)}%)
                </span>
              )}
            </div>
          )}

          {item.status === 'error' && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.errorMessage || 'Lỗi chuyển đổi'}</span>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {item.status === 'completed' && item.convertedUrl && (
            <>
              <button
                type="button"
                onClick={handleTogglePlayConverted}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isPlayingConverted ? <Pause className="w-4 h-4 text-amber-600" /> : <Play className="w-4 h-4 text-indigo-600" />}
                {isPlayingConverted ? 'Tạm dừng' : 'Nghe thử MP3'}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Tải MP3
              </button>
            </>
          )}

          {(item.status === 'idle' || item.status === 'error') && (
            <button
              type="button"
              onClick={() => onConvert(item.id)}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Music3 className="w-4 h-4" />
              Chuyển Đổi MP3
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      <AudioTrimModal
        isOpen={isTrimModalOpen}
        onClose={() => setIsTrimModalOpen(false)}
        audioBuffer={item.audioBuffer}
        settings={item.settings}
        onSaveSettings={(newSettings) => onUpdateSettings(item.id, newSettings)}
        fileName={item.name}
      />

      <TagEditModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        tags={item.tags}
        onSave={(newTags) => onUpdateTags(item.id, newTags)}
        fileName={item.name}
      />

      <SingleAudioSilenceModal
        isOpen={isSilenceModalOpen}
        onClose={() => setIsSilenceModalOpen(false)}
        item={item}
        onSaveSettings={(id, newSettings) => onUpdateSettings(id, newSettings)}
        onApplyAll={onApplyAllSilence}
      />
    </div>
  );
};
