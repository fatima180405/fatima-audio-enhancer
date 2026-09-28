import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Layers,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Download,
  Clock,
  Music,
  Check,
  Volume2,
  Sliders,
  Sparkles,
  FileAudio,
  ArrowUpDown,
  ListOrdered,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { AudioFileItem, BitrateOption, ConversionSettings, ID3Tags } from '../types';
import { formatDuration, formatFileSize } from '../utils/formatters';
import { mergeAudioItemsToMp3, MergeAudioTrackItem } from '../utils/audioEncoder';

interface AudioMergerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: AudioFileItem[];
  globalBitrate: BitrateOption;
  globalVolume: number;
}

interface MergingItemState {
  item: AudioFileItem;
  selected: boolean;
  customGap: number | null; // null means inherit global master gapSeconds
}

const PRESET_GAP_OPTIONS: { value: number; label: string; highlight?: boolean }[] = [
  { value: 0, label: '0s (Nối liền không ngắt)' },
  { value: 0.5, label: '0.5 giây' },
  { value: 1.0, label: '1.0 giây (Mặc định)' },
  { value: 2.0, label: '2.0 giây' },
  { value: 3.0, label: '3.0 giây' },
  { value: 5.0, label: '5.0 giây' },
  { value: 10.0, label: '10 giây' },
  { value: 15.0, label: '15 giây (IELTS / Luyện nghe)', highlight: true },
  { value: 20.0, label: '20 giây' },
  { value: 30.0, label: '30 giây (Nghỉ đọc đề IELTS)', highlight: true },
  { value: 45.0, label: '45 giây (Chuẩn bị Part)', highlight: true },
  { value: 60.0, label: '60 giây (1 phút)', highlight: true },
  { value: 90.0, label: '90 giây (1.5 phút)' },
  { value: 120.0, label: '120 giây (2 phút)' },
];

const QUICK_GAP_BADGES: { value: number; label: string; highlight?: boolean }[] = [
  { value: 0, label: '0s' },
  { value: 1, label: '1s' },
  { value: 5, label: '5s' },
  { value: 15, label: '15s (IELTS)', highlight: true },
  { value: 30, label: '30s (IELTS)', highlight: true },
  { value: 45, label: '45s', highlight: true },
  { value: 60, label: '1 phút (60s)', highlight: true },
];

function formatGapDescription(sec: number): string {
  if (sec === 0) return '0 giây (Nối liền)';
  if (sec < 60) return `${sec} giây`;
  const mins = Math.floor(sec / 60);
  const remSec = Math.round((sec % 60) * 10) / 10;
  if (remSec === 0) return `${mins} phút (${sec}s)`;
  return `${mins} phút ${remSec}s (${sec}s)`;
}

export const AudioMergerModal: React.FC<AudioMergerModalProps> = ({
  isOpen,
  onClose,
  items,
  globalBitrate,
  globalVolume,
}) => {
  // Ordered array of items with selection status and optional custom gap
  const [orderedItems, setOrderedItems] = useState<MergingItemState[]>([]);

  // Master silence gap settings
  const [gapSeconds, setGapSeconds] = useState<number>(15.0);
  const [customGapInput, setCustomGapInput] = useState<string>('15');
  const [includeEndGap, setIncludeEndGap] = useState<boolean>(false);
  const customGapInputRef = useRef<HTMLInputElement | null>(null);

  // Quality & master options
  const [outputName, setOutputName] = useState<string>('Audio_Gop_Hoan_Chinh');
  const [bitrate, setBitrate] = useState<BitrateOption>(globalBitrate);
  const [volume, setVolume] = useState<number>(globalVolume);
  const [tags, setTags] = useState<ID3Tags>({
    title: 'Audio Đã Gộp',
    artist: 'Audio Merger MP3',
    album: 'Gộp File Trực Tuyến',
    genre: 'Audio',
    year: new Date().getFullYear().toString(),
  });

  // State for active editing of custom gap in inline connector
  const [editingGapIndex, setEditingGapIndex] = useState<number | null>(null);

  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergedDuration, setMergedDuration] = useState<number>(0);

  // Audio preview state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOrderedItems(
        items.map((item) => ({
          item,
          selected: true,
          customGap: item.settings.padSilenceEnd && item.settings.padSilenceEnd > 0 ? item.settings.padSilenceEnd : null,
        }))
      );
      setBitrate(globalBitrate);
      setVolume(globalVolume);
      setGapSeconds(15.0);
      setCustomGapInput('15');
      setIncludeEndGap(false);
      setEditingGapIndex(null);
      setIsMerging(false);
      setProgress(0);
      setMergedBlob(null);
      if (mergedUrl) {
        URL.revokeObjectURL(mergedUrl);
        setMergedUrl(null);
      }
      setIsPlaying(false);
    }
  }, [isOpen, items, globalBitrate, globalVolume]);

  if (!isOpen) return null;

  const handleSelectMasterGap = (val: number) => {
    setGapSeconds(val);
    setCustomGapInput(val.toString());
  };

  const handleCustomMasterGapChange = (raw: string) => {
    setCustomGapInput(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      setGapSeconds(Math.min(3600, parsed));
    } else if (raw.trim() === '') {
      setGapSeconds(0);
    }
  };

  const handleApplyMasterToAllGaps = () => {
    setOrderedItems((prev) =>
      prev.map((i) => ({ ...i, customGap: null }))
    );
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setOrderedItems((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= orderedItems.length - 1) return;
    setOrderedItems((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const toggleSelect = (index: number) => {
    setOrderedItems((prev) =>
      prev.map((i, idx) => (idx === index ? { ...i, selected: !i.selected } : i))
    );
  };

  const selectAll = (val: boolean) => {
    setOrderedItems((prev) => prev.map((i) => ({ ...i, selected: val })));
  };

  const sortByNameAZ = () => {
    setOrderedItems((prev) =>
      [...prev].sort((a, b) => a.item.name.localeCompare(b.item.name, undefined, { numeric: true, sensitivity: 'base' }))
    );
  };

  const reverseOrder = () => {
    setOrderedItems((prev) => [...prev].reverse());
  };

  const handleSetTrackGap = (index: number, gap: number | null) => {
    setOrderedItems((prev) =>
      prev.map((i, idx) => (idx === index ? { ...i, customGap: gap } : i))
    );
  };

  const selectedEntries = orderedItems.filter((i) => i.selected);

  // Accurate duration computation
  const rawAudioDuration = selectedEntries.reduce((acc, curr) => {
    const dur =
      curr.item.settings.endTime > 0
        ? curr.item.settings.endTime - curr.item.settings.startTime
        : curr.item.duration;
    const speed = curr.item.settings.speed || 1.0;
    return acc + Math.max(0, dur / speed);
  }, 0);

  let totalSilenceDuration = 0;
  let totalGapCount = 0;

  for (let idx = 0; idx < selectedEntries.length; idx++) {
    const isLast = idx === selectedEntries.length - 1;
    const entry = selectedEntries[idx];
    if (!isLast || includeEndGap) {
      const g = entry.customGap !== null && entry.customGap !== undefined ? entry.customGap : gapSeconds;
      totalSilenceDuration += g;
      if (g > 0) totalGapCount++;
    }
  }

  const totalMergedDuration = rawAudioDuration + totalSilenceDuration;

  const handleStartMerge = async () => {
    if (selectedEntries.length === 0) return;

    setIsMerging(true);
    setProgress(0);
    setMergedBlob(null);

    if (mergedUrl) {
      URL.revokeObjectURL(mergedUrl);
      setMergedUrl(null);
    }

    try {
      const masterSettings: ConversionSettings = {
        bitrate,
        sampleRate: 0,
        channels: 'stereo',
        volume,
        startTime: 0,
        endTime: 0,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
      };

      const prepareItems: MergeAudioTrackItem[] = selectedEntries.map((entry, idx) => {
        const isLast = idx === selectedEntries.length - 1;
        let trackGap: number | null = null;
        if (entry.customGap !== null && entry.customGap !== undefined) {
          trackGap = entry.customGap;
        } else if (!isLast || includeEndGap) {
          trackGap = gapSeconds;
        } else {
          trackGap = 0;
        }

        return {
          file: entry.item.file,
          buffer: entry.item.audioBuffer,
          settings: entry.item.settings,
          gapAfterSeconds: trackGap,
        };
      });

      const blob = await mergeAudioItemsToMp3(
        prepareItems,
        masterSettings,
        tags,
        gapSeconds,
        (pct) => setProgress(pct),
        includeEndGap ? gapSeconds : 0
      );

      const url = URL.createObjectURL(blob);
      setMergedBlob(blob);
      setMergedUrl(url);
      setMergedDuration(totalMergedDuration);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi gộp file audio.');
    } finally {
      setIsMerging(false);
    }
  };

  const togglePlayPreview = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!mergedUrl || !mergedBlob) return;
    const filename = outputName.trim()
      ? `${outputName.replace(/\.mp3$/i, '')}.mp3`
      : 'Audio_Gop_Hoan_Chinh.mp3';

    const a = document.createElement('a');
    a.href = mergedUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Gộp Nhiều File Audio Thành 1 MP3 Duy Nhất</h3>
                <span className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-extrabold uppercase rounded-full">
                  IELTS / Listening
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hỗ trợ 2, 5, 10 hoặc nhiều files — cho phép chèn khoảng lặng tùy chỉnh sau từng file hoặc dùng khoảng chung
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {/* Master Silence Gap Settings Panel */}
          <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Khoảng lặng chung giữa các file (Master Gap):</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-700 bg-white border border-indigo-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                  Hiện tại: {formatGapDescription(gapSeconds)}
                </span>
                <button
                  type="button"
                  onClick={handleApplyMasterToAllGaps}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-100/60 hover:bg-indigo-100 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                  title="Đặt lại tất cả các khoảng nối về giá trị chung này"
                >
                  Áp dụng lại cho tất cả file
                </button>
              </div>
            </div>

            {/* Presets & Quick Badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-center">
              <div>
                <select
                  value={PRESET_GAP_OPTIONS.some((p) => Math.abs(p.value - gapSeconds) < 0.001) ? gapSeconds : 'custom'}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      customGapInputRef.current?.focus();
                      customGapInputRef.current?.select();
                    } else {
                      handleSelectMasterGap(parseFloat(e.target.value));
                    }
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  {PRESET_GAP_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value} className={p.highlight ? 'font-bold text-indigo-900' : ''}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">✏️ Tự điền số giây tùy chỉnh ({gapSeconds}s)...</option>
                </select>
              </div>

              {/* Quick Preset Badges */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 mr-0.5">Gợi ý:</span>
                {QUICK_GAP_BADGES.map((badge) => (
                  <button
                    key={badge.value}
                    type="button"
                    onClick={() => handleSelectMasterGap(badge.value)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all border cursor-pointer ${
                      Math.abs(gapSeconds - badge.value) < 0.001
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : badge.highlight
                        ? 'bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-100 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {badge.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Seconds Input & Final Gap Checkbox */}
            <div className="pt-2.5 border-t border-indigo-100/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Tự điền số giây:</span>
                <div className="relative flex-1 max-w-[160px]">
                  <input
                    ref={customGapInputRef}
                    type="number"
                    min="0"
                    max="3600"
                    step="any"
                    value={customGapInput}
                    onChange={(e) => handleCustomMasterGapChange(e.target.value)}
                    className="w-full pl-2.5 pr-11 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
                    giây
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectMasterGap(Math.max(0, gapSeconds - 5))}
                    className="px-2 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-colors"
                    title="Giảm 5 giây"
                  >
                    -5s
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMasterGap(Math.min(3600, gapSeconds + 5))}
                    className="px-2 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-colors"
                    title="Tăng 5 giây"
                  >
                    +5s
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMasterGap(Math.min(3600, gapSeconds + 15))}
                    className="px-2 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-xs font-bold text-indigo-700 transition-colors"
                    title="Tăng 15 giây"
                  >
                    +15s
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMasterGap(Math.min(3600, gapSeconds + 30))}
                    className="px-2 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-xs font-bold text-indigo-700 transition-colors"
                    title="Tăng 30 giây"
                  >
                    +30s
                  </button>
                </div>
              </div>

              {/* Checkbox: Add silence after the last track too */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 shadow-2xs shrink-0">
                <input
                  type="checkbox"
                  checked={includeEndGap}
                  onChange={(e) => setIncludeEndGap(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
                <span>Thêm khoảng trống cả sau file cuối cùng (IELTS check đáp án)</span>
              </label>
            </div>
          </div>

          {/* Track List Section (Accommodating 5, 10 or more files smoothly) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileAudio className="w-4 h-4 text-indigo-600" />
                <span>Thứ tự ghép nối ({selectedEntries.length}/{orderedItems.length} file đã chọn):</span>
              </label>

              {/* Quick List Actions for 5-10+ files */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => selectAll(true)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => selectAll(false)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={sortByNameAZ}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                  title="Sắp xếp danh sách file theo thứ tự chữ cái A-Z hoặc số thứ tự"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  Sắp xếp A-Z
                </button>
                <button
                  type="button"
                  onClick={reverseOrder}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                  title="Đảo ngược thứ tự các file"
                >
                  <RotateCcw className="w-3 h-3" />
                  Đảo thứ tự
                </button>
              </div>
            </div>

            {/* Scrollable File List with Visual Connectors */}
            <div className="max-h-72 overflow-y-auto pr-1.5 border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 space-y-2">
              {orderedItems.map(({ item, selected, customGap }, index) => {
                const isLast = index === orderedItems.length - 1;
                const activeGap = customGap !== null ? customGap : gapSeconds;
                const showConnector = !isLast || includeEndGap;

                return (
                  <div key={item.id} className="space-y-1.5">
                    {/* File Card Row */}
                    <div
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border text-xs transition-all ${
                        selected
                          ? 'bg-white border-indigo-200/90 shadow-xs'
                          : 'bg-slate-100/70 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(index)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                        />
                        <span className="w-6 h-6 flex items-center justify-center font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate max-w-xs sm:max-w-md" title={item.name}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{formatFileSize(item.originalSize)}</span>
                            <span>•</span>
                            <span className="text-indigo-700 font-bold">
                              {formatDuration(item.duration / (item.settings.speed || 1.0))}
                            </span>
                            {customGap !== null && (
                              <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                                Nghỉ riêng: {customGap}s
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Move Up/Down Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveUp(index)}
                          className="p-1.5 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Chuyển lên trước"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === orderedItems.length - 1}
                          onClick={() => moveDown(index)}
                          className="p-1.5 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Chuyển xuống sau"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Gap Connector between File i and File i+1 (or after last file) */}
                    {showConnector && (
                      <div className="flex items-center justify-center gap-2 py-0.5 px-4">
                        <div className="h-px bg-indigo-200 flex-1 border-dashed border-t border-indigo-300" />
                        <div className="flex items-center gap-1.5 bg-white border border-indigo-200 px-2.5 py-1 rounded-full text-[11px] shadow-2xs">
                          <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="font-semibold text-slate-600">
                            Khoảng trống sau file {index + 1}:
                          </span>

                          {/* Inline Gap Selector for this specific track */}
                          <select
                            value={customGap === null ? 'master' : customGap}
                            onChange={(e) => {
                              if (e.target.value === 'master') {
                                handleSetTrackGap(index, null);
                              } else if (e.target.value === 'custom') {
                                setEditingGapIndex(editingGapIndex === index ? null : index);
                              } else {
                                handleSetTrackGap(index, parseFloat(e.target.value));
                              }
                            }}
                            className="bg-indigo-50/80 border border-indigo-200 text-indigo-900 font-bold rounded-md px-1.5 py-0.5 text-[11px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="master">
                              Khoảng chung ({formatGapDescription(gapSeconds)})
                            </option>
                            <option value={0}>0s (Nối liền không ngắt)</option>
                            <option value={5}>5s</option>
                            <option value={10}>10s</option>
                            <option value={15}>15s (IELTS)</option>
                            <option value={30}>30s (IELTS đọc đề)</option>
                            <option value={45}>45s (Chuẩn bị Part)</option>
                            <option value={60}>60s (1 phút)</option>
                            <option value={90}>90s (1.5 phút)</option>
                            <option value={120}>120s (2 phút)</option>
                            <option value="custom">✏️ Nhập số giây riêng...</option>
                          </select>

                          {/* Inline custom input if activated */}
                          {editingGapIndex === index && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="3600"
                                value={activeGap}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  handleSetTrackGap(index, !isNaN(v) ? Math.max(0, v) : 0);
                                }}
                                className="w-16 px-1.5 py-0.5 bg-white border border-indigo-300 rounded text-center text-[11px] font-bold text-slate-800"
                                placeholder="s"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => setEditingGapIndex(null)}
                                className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold"
                              >
                                Xong
                              </button>
                            </div>
                          )}

                          {customGap !== null && (
                            <button
                              type="button"
                              onClick={() => handleSetTrackGap(index, null)}
                              className="text-[10px] text-slate-400 hover:text-red-500 transition-colors ml-0.5"
                              title="Đặt lại theo khoảng chung"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="h-px bg-indigo-200 flex-1 border-dashed border-t border-indigo-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quality, Volume Booster & Output Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {/* Quality & Bitrate */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" /> Chất lượng MP3:
              </label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(parseInt(e.target.value, 10) as BitrateOption)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={320}>320 Kbps (Cao nhất)</option>
                <option value={256}>256 Kbps (Nét chuẩn)</option>
                <option value={192}>192 Kbps (Trung bình)</option>
                <option value={128}>128 Kbps (Tiết kiệm)</option>
              </select>
            </div>

            {/* Volume Booster */}
            <div>
              <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-amber-600" /> Tăng âm lượng:
              </label>
              <select
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full p-2 bg-white border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value={1.0}>100% (Mặc định)</option>
                <option value={1.25}>125% (+2 dB)</option>
                <option value={1.5}>150% (+3.5 dB)</option>
                <option value={2.0}>200% (+6 dB)</option>
                <option value={3.0}>300% (+9.5 dB)</option>
                <option value={4.0}>400% (+12 dB)</option>
              </select>
            </div>

            {/* Output File Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-indigo-600" /> Tên file đầu ra:
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-l-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                  placeholder="Tên file gộp..."
                />
                <span className="bg-slate-200 border border-l-0 border-slate-200 px-2 py-2 rounded-r-lg text-xs font-bold text-slate-600 shrink-0">
                  .mp3
                </span>
              </div>
            </div>
          </div>

          {/* Accurate Combined Info Bar */}
          <div className="flex items-center justify-between p-3.5 bg-indigo-50/80 border border-indigo-200/80 rounded-xl text-xs flex-wrap gap-2.5">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="text-slate-500">Số file ghép: </span>
                <strong className="text-indigo-950 font-bold">{selectedEntries.length} file</strong>
              </div>
              <div>
                <span className="text-slate-500">Âm thanh gốc: </span>
                <strong className="text-slate-800 font-bold">{formatDuration(rawAudioDuration)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Khoảng trống: </span>
                <strong className="text-indigo-700 font-bold">
                  {totalGapCount} đoạn nối ({totalSilenceDuration}s)
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Tổng thời lượng xuất: </span>
                <strong className="text-indigo-900 font-extrabold text-sm bg-indigo-100/80 px-2 py-0.5 rounded-md">
                  {formatDuration(totalMergedDuration)}
                </strong>
              </div>
            </div>
          </div>

          {/* Merging Progress Bar */}
          {isMerging && (
            <div className="space-y-1.5 p-4 bg-indigo-50/90 rounded-xl border border-indigo-200">
              <div className="flex justify-between text-xs font-bold text-indigo-900">
                <span>Đang xử lý ghép nối & mã hóa MP3 chất lượng cao...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-indigo-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-150 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Preview & Player */}
          {mergedUrl && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayPreview}
                  className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-md transition-all cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
                </button>
                <div>
                  <h4 className="font-bold text-emerald-950 text-xs sm:text-sm">
                    Ghép nối thành công! Đã sẵn sàng tải xuống.
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Thời lượng hoàn chỉnh: <strong>{formatDuration(mergedDuration)}</strong> ({mergedBlob ? formatFileSize(mergedBlob.size) : ''})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Tải File MP3 Đã Gộp
              </button>

              <audio
                ref={audioRef}
                src={mergedUrl}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={() => {
                  if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                }}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isMerging || selectedEntries.length === 0}
              onClick={handleStartMerge}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              {isMerging ? 'Đang Ghép Nối...' : `Bắt Đầu Ghép Nối (${selectedEntries.length} File)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
