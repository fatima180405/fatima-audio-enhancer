import React, { useState, useEffect, useRef } from 'react';
import { Clock, Sliders, Check, X, ArrowRight, Sparkles, Volume2 } from 'lucide-react';
import { AudioFileItem, ConversionSettings } from '../types';

interface SingleAudioSilenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: AudioFileItem | null;
  onSaveSettings: (id: string, settings: Partial<ConversionSettings>) => void;
  onApplyAll?: (settings: Partial<ConversionSettings>) => void;
}

const PRESET_GAP_OPTIONS: { value: number; label: string; desc?: string; highlight?: boolean }[] = [
  { value: 0, label: '0s (Không thêm khoảng lặng)' },
  { value: 3, label: '3 giây' },
  { value: 5, label: '5 giây' },
  { value: 10, label: '10 giây' },
  { value: 15, label: '15 giây', desc: 'IELTS / Luyện nghe', highlight: true },
  { value: 20, label: '20 giây' },
  { value: 30, label: '30 giây', desc: 'Nghỉ đọc câu hỏi đề thi', highlight: true },
  { value: 45, label: '45 giây', desc: 'Chuẩn bị Part / Section', highlight: true },
  { value: 60, label: '60 giây (1 phút)', desc: 'Kiểm tra đáp án', highlight: true },
  { value: 90, label: '90 giây (1.5 phút)' },
  { value: 120, label: '120 giây (2 phút)' },
];

const QUICK_BADGES = [
  { value: 0, label: '0s' },
  { value: 5, label: '5s' },
  { value: 15, label: '15s (IELTS)', highlight: true },
  { value: 30, label: '30s (IELTS)', highlight: true },
  { value: 45, label: '45s', highlight: true },
  { value: 60, label: '1 phút (60s)', highlight: true },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const SingleAudioSilenceModal: React.FC<SingleAudioSilenceModalProps> = ({
  isOpen,
  onClose,
  item,
  onSaveSettings,
  onApplyAll,
}) => {
  const [seconds, setSeconds] = useState<number>(15);
  const [customInput, setCustomInput] = useState<string>('15');
  const [position, setPosition] = useState<'end' | 'start' | 'both'>('end');
  const customInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      const currentEnd = item.settings.padSilenceEnd || 0;
      const currentStart = item.settings.padSilenceStart || 0;

      if (currentStart > 0 && currentEnd > 0 && currentStart === currentEnd) {
        setPosition('both');
        setSeconds(currentEnd);
        setCustomInput(currentEnd.toString());
      } else if (currentStart > 0 && currentEnd === 0) {
        setPosition('start');
        setSeconds(currentStart);
        setCustomInput(currentStart.toString());
      } else {
        setPosition('end');
        const val = currentEnd > 0 ? currentEnd : 15;
        setSeconds(val);
        setCustomInput(val.toString());
      }
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleSelectPreset = (val: number) => {
    setSeconds(val);
    setCustomInput(val.toString());
  };

  const handleCustomChange = (raw: string) => {
    setCustomInput(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      setSeconds(Math.min(3600, parsed));
    } else if (raw.trim() === '') {
      setSeconds(0);
    }
  };

  const handleStep = (delta: number) => {
    const next = Math.max(0, Math.min(3600, seconds + delta));
    setSeconds(next);
    setCustomInput(next.toString());
  };

  const getSettingsPayload = (): Partial<ConversionSettings> => {
    if (position === 'end') {
      return { padSilenceEnd: seconds, padSilenceStart: 0 };
    } else if (position === 'start') {
      return { padSilenceStart: seconds, padSilenceEnd: 0 };
    } else {
      return { padSilenceStart: seconds, padSilenceEnd: seconds };
    }
  };

  const handleSave = () => {
    onSaveSettings(item.id, getSettingsPayload());
    onClose();
  };

  const handleApplyToAll = () => {
    if (onApplyAll) {
      onApplyAll(getSettingsPayload());
      onClose();
    }
  };

  const origDuration = item.duration || 0;
  const addedDuration = position === 'both' ? seconds * 2 : seconds;
  const finalDuration = origDuration + addedDuration;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Thêm Khoảng Lặng Cho File Audio
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md font-medium" title={item.name}>
                {item.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Duration Preview Card */}
          <div className="p-3.5 bg-indigo-50/80 rounded-xl border border-indigo-200/80 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Thời lượng gốc:</span>
              <strong className="text-slate-800 font-bold text-sm">{formatTime(origDuration)}</strong>
            </div>

            <div className="flex items-center text-indigo-500">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div>
              <span className="text-indigo-600 block text-[11px] font-bold">Khoảng lặng chèn:</span>
              <strong className="text-indigo-700 font-bold text-sm">
                +{seconds}s {position === 'both' ? '(x2 đầu+cuối)' : ''}
              </strong>
            </div>

            <div className="flex items-center text-indigo-500">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div>
              <span className="text-emerald-700 block text-[11px] font-bold">Thời lượng hoàn chỉnh:</span>
              <strong className="text-emerald-700 font-bold text-sm bg-emerald-100/80 px-2 py-0.5 rounded-md">
                {formatTime(finalDuration)}
              </strong>
            </div>
          </div>

          {/* Position Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Vị trí chèn khoảng lặng:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPosition('end')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  position === 'end'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Cuối file</span>
                <span className="block text-[10px] font-normal opacity-85 mt-0.5">(Khuyên dùng cho đề thi)</span>
              </button>

              <button
                type="button"
                onClick={() => setPosition('start')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  position === 'start'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Đầu file</span>
                <span className="block text-[10px] font-normal opacity-85 mt-0.5">(Khoảng chờ ban đầu)</span>
              </button>

              <button
                type="button"
                onClick={() => setPosition('both')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  position === 'both'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Cả đầu & cuối</span>
                <span className="block text-[10px] font-normal opacity-85 mt-0.5">(Đệm 2 phía)</span>
              </button>
            </div>
          </div>

          {/* Preset Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                Chọn mốc thời gian khoảng trống:
              </label>
              <span className="text-[11px] font-bold text-indigo-600">
                Hiện tại: {seconds} giây
              </span>
            </div>

            <select
              value={PRESET_GAP_OPTIONS.some((p) => Math.abs(p.value - seconds) < 0.001) ? seconds : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  customInputRef.current?.focus();
                  customInputRef.current?.select();
                } else {
                  handleSelectPreset(parseFloat(e.target.value));
                }
              }}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              {PRESET_GAP_OPTIONS.map((p) => (
                <option key={p.value} value={p.value} className={p.highlight ? 'font-bold text-indigo-900' : ''}>
                  {p.label} {p.desc ? `— ${p.desc}` : ''}
                </option>
              ))}
              <option value="custom">✏️ Tự điền số giây tùy ý ({seconds}s)...</option>
            </select>

            {/* Quick Badges */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Chọn nhanh:</span>
              {QUICK_BADGES.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => handleSelectPreset(b.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                    Math.abs(seconds - b.value) < 0.001
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : b.highlight
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Seconds Input */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                Tự nhập số giây tùy chỉnh cá nhân hóa:
              </label>
              <span className="text-[11px] text-slate-500">(Tối đa 3600s = 60 phút)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={customInputRef}
                  type="number"
                  min="0"
                  max="3600"
                  step="any"
                  value={customInput}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="Nhập số giây..."
                  className="w-full pl-3 pr-14 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  giây
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleStep(-5)}
                  className="px-2 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-colors"
                  title="Giảm 5 giây"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(5)}
                  className="px-2 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-colors"
                  title="Tăng 5 giây"
                >
                  +5s
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(15)}
                  className="px-2 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-xs font-bold text-indigo-700 transition-colors"
                  title="Tăng 15 giây"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(30)}
                  className="px-2 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-xs font-bold text-indigo-700 transition-colors"
                  title="Tăng 30 giây"
                >
                  +30s
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <div>
            {onApplyAll && (
              <button
                type="button"
                onClick={handleApplyToAll}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                title="Áp dụng cùng số giây khoảng lặng này cho tất cả file đang có trong danh sách"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Áp dụng cho TẤT CẢ các file
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Lưu & Áp Dụng ({seconds}s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
