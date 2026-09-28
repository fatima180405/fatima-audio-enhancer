import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Archive,
  Trash2,
  Merge,
  Check,
  RotateCcw,
  ListPlus,
  Zap,
  FileText,
  Loader2,
  Copy,
  Volume2,
  Keyboard,
  Scissors,
} from 'lucide-react';
import JSZip from 'jszip';
import { AudioFileItem, BitrateOption, ID3Tags } from '../types';
import { formatDuration } from '../utils/formatters';
import {
  Segment,
  SplitterOptions,
  detectSpeechSegments,
  exportSegmentToMp3,
} from '../utils/silenceDetector';
import { decodeAudioFile } from '../utils/audioEncoder';

interface AudioSplitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: AudioFileItem | null;
  globalBitrate: BitrateOption;
  globalVolume: number;
  onAddSegmentsToMainList: (items: AudioFileItem[]) => void;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const AudioSplitterModal: React.FC<AudioSplitterModalProps> = ({
  isOpen,
  onClose,
  item,
  globalBitrate,
  globalVolume,
  onAddSegmentsToMainList,
}) => {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);

  // Detection settings
  const [thresholdDb, setThresholdDb] = useState<number>(-35); // -35 dB
  const [minSilenceDuration, setMinSilenceDuration] = useState<number>(0.4); // 0.4s
  const [minSpeechDuration, setMinSpeechDuration] = useState<number>(0.5); // 0.5s
  const [paddingDuration, setPaddingDuration] = useState<number>(0.15); // 0.15s
  const [maxSpeechDuration, setMaxSpeechDuration] = useState<number>(6.0); // 6.0s max sentence limit

  // Auto-play options
  const [autoPlayOnFocus, setAutoPlayOnFocus] = useState<boolean>(true);

  // Detected segments
  const [segments, setSegments] = useState<Segment[]>([]);

  // Input refs for smooth Tab/Enter navigation
  const inputRefs = useRef<{ [id: string]: HTMLInputElement | null }>({});

  // Audio Preview player state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [previewSegmentId, setPreviewSegmentId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Export ZIP progress
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [currentExportIndex, setCurrentExportIndex] = useState<number>(0);

  // AI Transcribe state
  const [isTranscribingAll, setIsTranscribingAll] = useState<boolean>(false);
  const [transcribingIndex, setTranscribingIndex] = useState<number>(0);
  const [singleTranscribingId, setSingleTranscribingId] = useState<string | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);

  // Load / decode audio buffer on modal open
  useEffect(() => {
    if (!isOpen || !item) {
      setBuffer(null);
      setSegments([]);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setIsPlaying(false);
      return;
    }

    const url = URL.createObjectURL(item.file);
    setAudioUrl(url);

    const initBuffer = async () => {
      if (item.audioBuffer) {
        setBuffer(item.audioBuffer);
        runDetection(item.audioBuffer, {
          silenceThresholdDb: thresholdDb,
          minSilenceDuration,
          minSpeechDuration,
          paddingDuration,
          maxSpeechDuration,
        });
      } else {
        setIsDecoding(true);
        try {
          const buf = await decodeAudioFile(item.file);
          setBuffer(buf);
          runDetection(buf, {
            silenceThresholdDb: thresholdDb,
            minSilenceDuration,
            minSpeechDuration,
            paddingDuration,
            maxSpeechDuration,
          });
        } catch (err) {
          console.error('Failed to decode audio:', err);
          alert('Không thể giải mã file audio để phân tích khoảng lặng.');
        } finally {
          setIsDecoding(false);
        }
      }
    };

    initBuffer();
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const runDetection = (buf: AudioBuffer, options: SplitterOptions) => {
    const results = detectSpeechSegments(buf, options);
    setSegments(results);
  };

  const handleApplyDetection = () => {
    if (!buffer) return;
    runDetection(buffer, {
      silenceThresholdDb: thresholdDb,
      minSilenceDuration,
      minSpeechDuration,
      paddingDuration,
      maxSpeechDuration,
    });
  };

  // Preview segment play/pause
  const playSegment = (seg: Segment) => {
    if (!audioRef.current || !audioUrl) return;

    if (previewSegmentId === seg.id && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    setPreviewSegmentId(seg.id);
    audioRef.current.currentTime = seg.startTime;
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
  };

  // Auto play when focus enters an input
  const handleInputFocus = (seg: Segment) => {
    if (autoPlayOnFocus) {
      playSegment(seg);
    }
  };

  // Handle keyboard shortcuts (Enter / Shift+Enter to move to next/prev sentence and play)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = e.shiftKey ? index - 1 : index + 1;
      if (nextIndex >= 0 && nextIndex < segments.length) {
        const nextSeg = segments[nextIndex];
        const nextInput = inputRefs.current[nextSeg.id];
        if (nextInput) {
          nextInput.focus();
          playSegment(nextSeg);
        }
      }
    }
  };

  // Monitor audio time update to stop when segment end is reached
  const handleTimeUpdate = () => {
    if (!audioRef.current || !previewSegmentId) return;
    const currentSeg = segments.find((s) => s.id === previewSegmentId);
    if (currentSeg && audioRef.current.currentTime >= currentSeg.endTime) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Delete segment
  const handleDeleteSegment = (id: string) => {
    setSegments((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, index: idx + 1 }))
    );
  };

  // Merge segment with next
  const handleMergeNext = (index: number) => {
    if (index >= segments.length - 1) return;
    setSegments((prev) => {
      const next = [...prev];
      const current = next[index];
      const target = next[index + 1];

      const merged: Segment = {
        ...current,
        endTime: target.endTime,
        duration: Number((target.endTime - current.startTime).toFixed(2)),
        transcript: [current.transcript, target.transcript].filter(Boolean).join(' '),
      };

      next.splice(index, 2, merged);
      return next.map((s, idx) => ({ ...s, index: idx + 1 }));
    });
  };

  // Edit times
  const handleUpdateSegmentTime = (id: string, start: number, end: number) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              startTime: Math.max(0, start),
              endTime: Math.max(start + 0.1, end),
              duration: Number((Math.max(start + 0.1, end) - Math.max(0, start)).toFixed(2)),
            }
          : s
      )
    );
  };

  // Edit transcript for a segment
  const handleUpdateTranscript = (id: string, text: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, transcript: text } : s))
    );
  };

  // Transcribe single segment with Gemini AI
  const handleTranscribeSingle = async (seg: Segment) => {
    if (!buffer) return;
    setSingleTranscribingId(seg.id);

    try {
      const tags: ID3Tags = {
        title: `Temp Segment ${seg.index}`,
        artist: 'AI Transcriber',
        album: 'Temp',
        genre: 'Speech',
        year: '2026',
      };
      const mp3Blob = await exportSegmentToMp3(
        buffer,
        seg,
        128,
        1.0,
        tags
      );
      const base64 = await blobToBase64(mp3Blob);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/mp3' }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        handleUpdateTranscript(seg.id, data.text);
      } else {
        alert(data.error || 'Không thể tạo transcript cho câu này.');
      }
    } catch (err: any) {
      console.error('Lỗi khi AI transcribe:', err);
      alert('Đã xảy ra lỗi kết nối AI Transcribe.');
    } finally {
      setSingleTranscribingId(null);
    }
  };

  // Transcribe all segments with Gemini AI
  const handleTranscribeAll = async () => {
    if (!buffer || segments.length === 0) return;

    setIsTranscribingAll(true);
    setTranscribingIndex(0);

    const tags: ID3Tags = {
      title: 'Temp Segment',
      artist: 'AI Transcriber',
      album: 'Temp',
      genre: 'Speech',
      year: '2026',
    };

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      setTranscribingIndex(i + 1);

      try {
        const mp3Blob = await exportSegmentToMp3(buffer, seg, 128, 1.0, tags);
        const base64 = await blobToBase64(mp3Blob);

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/mp3' }),
        });

        const data = await res.json();
        if (res.ok && data.text) {
          handleUpdateTranscript(seg.id, data.text);
        }
      } catch (err) {
        console.error(`Lỗi transcribe câu #${seg.index}:`, err);
      }
    }

    setIsTranscribingAll(false);
  };

  // Generate complete formatted transcript text
  const generateTranscriptText = () => {
    const lines: string[] = [];

    lines.push('================================================================================');
    lines.push(`TRANSCRIPT BẢN GHI ÂM THANH - SMART AUDIO SPLITTER`);
    lines.push('================================================================================');
    lines.push(`File gốc: ${item.name}`);
    lines.push(`Tổng số câu: ${segments.length} câu`);
    lines.push(`Tổng thời lượng file: ${formatDuration(item.duration)}`);
    lines.push(`Thời gian khởi tạo: ${new Date().toLocaleString('vi-VN')}`);
    lines.push('================================================================================\n');

    lines.push('--------------------------------------------------------------------------------');
    lines.push('DANH SÁCH CHI TIẾT TỪNG CÂU (LẦN LƯỢT TỪ TRÊN XUỐNG DƯỚI):');
    lines.push('--------------------------------------------------------------------------------\n');

    segments.forEach((seg) => {
      const numStr = String(seg.index).padStart(2, '0');
      const timeRange = `[${formatDuration(seg.startTime)} -> ${formatDuration(seg.endTime)}] (${seg.duration}s)`;
      const text = seg.transcript && seg.transcript.trim() ? seg.transcript.trim() : '(Chưa có transcript)';

      lines.push(`[Câu ${numStr}] ${timeRange}:`);
      lines.push(`${text}\n`);
    });

    lines.push('================================================================================');
    lines.push('TOÀN BỘ VĂN BẢN NỐI LIỀN (CONTINUOUS TEXT):');
    lines.push('================================================================================');
    const continuousText = segments
      .map((s) => s.transcript?.trim() || '')
      .filter(Boolean)
      .join(' ');
    lines.push(continuousText || '(Chưa có nội dung văn bản)');

    return lines.join('\n');
  };

  // Copy transcript to clipboard
  const handleCopyTranscript = () => {
    const text = generateTranscriptText();
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Export ZIP containing all sentence audio files as MP3 AND transcript.txt
  const handleExportZip = async () => {
    if (!buffer || segments.length === 0) return;

    setIsExportingZip(true);
    setExportProgress(0);
    setCurrentExportIndex(0);

    const zip = new JSZip();
    const folderName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
    const zipFolder = zip.folder(`${folderName}_Cau_Noi_MP3`);

    const tags: ID3Tags = {
      title: `${folderName} - Tap Cau`,
      artist: 'Smart Audio Splitter',
      album: folderName,
      genre: 'Speech/Audio',
      year: new Date().getFullYear().toString(),
    };

    try {
      // 1. Generate MP3 for each segment
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        setCurrentExportIndex(i + 1);

        const mp3Blob = await exportSegmentToMp3(
          buffer,
          seg,
          globalBitrate,
          globalVolume,
          tags,
          (pct) => {
            const overall = Math.round(((i + pct / 100) / segments.length) * 100);
            setExportProgress(overall);
          }
        );

        const numStr = String(seg.index).padStart(2, '0');
        const filename = `${folderName}_Cau_${numStr}.mp3`;
        zipFolder?.file(filename, mp3Blob);
      }

      // 2. Generate and add transcript.txt to the ZIP file
      const transcriptContent = generateTranscriptText();
      zipFolder?.file(`transcript.txt`, transcriptContent);
      zip.file(`${folderName}_Transcript.txt`, transcriptContent);

      setExportProgress(98);
      const content = await zip.generateAsync({ type: 'blob' });

      const downloadUrl = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${folderName}_Tap_Cau_MP3.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setExportProgress(100);
    } catch (err) {
      console.error('Lỗi khi xuất ZIP:', err);
      alert('Đã xảy ra lỗi khi tạo file ZIP các câu nói.');
    } finally {
      setIsExportingZip(false);
    }
  };

  // Add detected segments to Main Application List
  const handleAddToMainList = async () => {
    if (!buffer || segments.length === 0) return;

    const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
    const newItems: AudioFileItem[] = [];

    for (const seg of segments) {
      const numStr = String(seg.index).padStart(2, '0');
      const segmentName = `${baseName}_Cau_${numStr}.${item.name.split('.').pop()}`;

      const newItem: AudioFileItem = {
        id: `seg_item_${Math.random().toString(36).substring(2, 9)}`,
        file: item.file,
        name: segmentName,
        originalFormat: item.originalFormat || 'mp3',
        originalSize: item.originalSize,
        duration: seg.duration,
        audioBuffer: buffer,
        settings: {
          bitrate: globalBitrate,
          sampleRate: 0,
          channels: 'stereo',
          volume: globalVolume,
          startTime: seg.startTime,
          endTime: seg.endTime,
          fadeInSeconds: 0,
          fadeOutSeconds: 0,
        },
        tags: {
          title: seg.transcript ? seg.transcript.substring(0, 30) : `${baseName} - Câu ${numStr}`,
          artist: item.tags?.artist || 'Audio Splitter',
          album: baseName,
          genre: 'Speech',
          year: new Date().getFullYear().toString(),
        },
        status: 'idle',
        progress: 0,
        convertedBlob: null,
        convertedUrl: null,
      };

      newItems.push(newItem);
    }

    onAddSegmentsToMainList(newItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Hidden HTML Audio element for preview */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Tách Câu Tự Động & Chế Độ Nhập Liệu Siêu Mượt</h3>
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase rounded-full">
                  AI VAD + Auto Play
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                Tự động cắt file <strong className="text-amber-300">{item.name}</strong> thành câu ngắn & tự phát tiếng khi gõ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {isDecoding ? (
            <div className="py-12 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Đang giải mã và phân tích dữ liệu sóng âm...</p>
            </div>
          ) : (
            <>
              {/* Controls & Sensitivity Settings */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-600" /> Thông số cắt ngắt câu âm thanh
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isTranscribingAll || segments.length === 0}
                      onClick={handleTranscribeAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-xs disabled:opacity-50"
                    >
                      {isTranscribingAll ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang nhận diện câu #{transcribingIndex}...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 fill-current" /> AI Auto-Transcribe
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyDetection}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Quét & Cắt Lại
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                  {/* Max Speech Duration (MỚI: Giới hạn độ dài tối đa mỗi câu) */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200 ring-1 ring-amber-300/40 space-y-1">
                    <div className="flex justify-between font-bold text-amber-950">
                      <span className="flex items-center gap-1">
                        <Scissors className="w-3.5 h-3.5 text-amber-600" /> Độ dài tối đa:
                      </span>
                      <strong className="text-amber-600">{maxSpeechDuration}s</strong>
                    </div>
                    <input
                      type="range"
                      min={3.0}
                      max={15.0}
                      step={0.5}
                      value={maxSpeechDuration}
                      onChange={(e) => setMaxSpeechDuration(parseFloat(e.target.value))}
                      className="w-full accent-amber-600 h-1.5 bg-amber-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-amber-700/80">
                      <span>Cắt ngắn (3s)</span>
                      <span>Vừa phải (6s)</span>
                      <span>Dài (15s)</span>
                    </div>
                  </div>

                  {/* Silence Threshold */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Độ nhạy ngắt (dB):</span>
                      <strong className="text-indigo-600">{thresholdDb} dB</strong>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={-20}
                      step={1}
                      value={thresholdDb}
                      onChange={(e) => setThresholdDb(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Nhạy (-50)</span>
                      <span>Chuẩn (-35)</span>
                      <span>To (-20)</span>
                    </div>
                  </div>

                  {/* Min Silence Duration */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Thời gian im lặng:</span>
                      <strong className="text-indigo-600">{minSilenceDuration}s</strong>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={1.5}
                      step={0.05}
                      value={minSilenceDuration}
                      onChange={(e) => setMinSilenceDuration(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Nhanh (0.2s)</span>
                      <span>Chậm (1.5s)</span>
                    </div>
                  </div>

                  {/* Min Speech Duration */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Độ dài câu tối thiểu:</span>
                      <strong className="text-indigo-600">{minSpeechDuration}s</strong>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={2.0}
                      step={0.1}
                      value={minSpeechDuration}
                      onChange={(e) => setMinSpeechDuration(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Giữ âm ngắn</span>
                      <span>Chỉ câu dài</span>
                    </div>
                  </div>

                  {/* Padding Duration */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Lề đệm mở/khóa:</span>
                      <strong className="text-indigo-600">+{paddingDuration}s</strong>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={0.4}
                      step={0.05}
                      value={paddingDuration}
                      onChange={(e) => setPaddingDuration(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Sát từ</span>
                      <span>Êm tai</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seamless Typing & Auto-Play Options Banner */}
              <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-950 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAutoPlayOnFocus(!autoPlayOnFocus)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      autoPlayOnFocus
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-600'
                        : 'bg-white border border-amber-300 text-slate-600 hover:bg-amber-100'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Tự động phát tiếng khi click / Enter sang câu mới ({autoPlayOnFocus ? 'BẬT' : 'TẮT'})</span>
                  </button>

                  <div className="hidden md:flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                    <Keyboard className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mẹo: Nhập nội dung câu xong bấm phím <kbd className="px-1.5 py-0.5 bg-white border border-amber-300 rounded font-mono font-bold text-amber-900">Enter</kbd> để nhảy ngay sang câu tiếp theo & tự động phát tiếng!</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyTranscript}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-amber-900 font-bold transition-all text-xs"
                  >
                    {copiedTranscript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Đã Copy!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-700" /> Copy Transcript (.TXT)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Segment Summary Header */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
                <span>
                  Đã chia thành <strong className="text-indigo-600 font-extrabold text-sm">{segments.length} câu</strong> (Tối đa {maxSpeechDuration}s / câu)
                </span>
                <span>
                  Tổng thời lượng: <strong className="text-slate-900">{formatDuration(item.duration)}</strong>
                </span>
              </div>

              {/* Segment List */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1 border border-slate-200 rounded-2xl p-2.5 bg-slate-50/50">
                {segments.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Không tìm thấy khoảng lặng phù hợp với thông số hiện tại. Hãy điều chỉnh độ nhạy dB hoặc độ dài tối đa!
                  </div>
                ) : (
                  segments.map((seg, idx) => {
                    const isSelectedPreview = previewSegmentId === seg.id && isPlaying;
                    const isRowTranscribing = singleTranscribingId === seg.id;

                    return (
                      <div
                        key={seg.id}
                        className={`flex flex-col gap-2 p-3 rounded-xl border text-xs transition-all ${
                          isSelectedPreview
                            ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Top row: controls, time editor, play */}
                        <div className="flex items-center justify-between gap-3">
                          {/* Segment Info & Play */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => playSegment(seg)}
                              className={`p-2 rounded-xl text-white font-bold transition-transform active:scale-90 shrink-0 ${
                                isSelectedPreview
                                  ? 'bg-amber-600'
                                  : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                              title={isSelectedPreview ? 'Tạm dừng' : 'Nghe thử câu này'}
                            >
                              {isSelectedPreview ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900">
                                  Câu #{seg.index}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold ${
                                  seg.duration > maxSpeechDuration
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {seg.duration}s
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                <span>Từ {formatDuration(seg.startTime)}</span>
                                <span>→</span>
                                <span>{formatDuration(seg.endTime)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Fine Tuning Time Editors & Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Fine tune times */}
                            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={seg.startTime}
                                onChange={(e) =>
                                  handleUpdateSegmentTime(
                                    seg.id,
                                    parseFloat(e.target.value) || 0,
                                    seg.endTime
                                  )
                                }
                                className="w-14 bg-white px-1.5 py-0.5 text-[11px] font-mono border border-slate-200 rounded text-center font-bold"
                              />
                              <span className="text-[10px] text-slate-400">s -</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={seg.endTime}
                                onChange={(e) =>
                                  handleUpdateSegmentTime(
                                    seg.id,
                                    seg.startTime,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-14 bg-white px-1.5 py-0.5 text-[11px] font-mono border border-slate-200 rounded text-center font-bold"
                              />
                              <span className="text-[10px] text-slate-400">s</span>
                            </div>

                            {/* Merge with next */}
                            {idx < segments.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMergeNext(idx)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                                title="Gộp câu này với câu kế tiếp"
                              >
                                <Merge className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSegment(seg.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                              title="Xóa câu này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Bottom row: Transcript Input & AI Transcribe button */}
                        <div className="flex items-center gap-2 pt-1">
                          <div className="relative flex-1">
                            <input
                              ref={(el) => (inputRefs.current[seg.id] = el)}
                              type="text"
                              value={seg.transcript || ''}
                              onChange={(e) => handleUpdateTranscript(seg.id, e.target.value)}
                              onFocus={() => handleInputFocus(seg)}
                              onKeyDown={(e) => handleKeyDown(e, idx)}
                              placeholder="Nhập nội dung câu thoại (Bấm Enter để sang câu tiếp theo & tự phát tiếng)..."
                              className="w-full text-xs font-medium pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder-slate-400 transition-all"
                            />
                            <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          </div>

                          <button
                            type="button"
                            disabled={isRowTranscribing || isTranscribingAll}
                            onClick={() => handleTranscribeSingle(seg)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-[11px] transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                            title="Sử dụng Gemini AI để gõ lại tiếng trong đoạn này"
                          >
                            {isRowTranscribing ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                <span>Đang dịch...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span>AI Gõ Chữ</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ZIP Export Progress Indicator */}
              {isExportingZip && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" /> Đang xuất file MP3
                      câu #{currentExportIndex}/{segments.length} và đóng gói transcript.txt...
                    </span>
                    <span>{exportProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-150 rounded-full"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isExportingZip || segments.length === 0}
              onClick={handleAddToMainList}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-40"
            >
              <ListPlus className="w-4 h-4 text-emerald-400" /> Thêm {segments.length} Câu Vào Danh Sách
            </button>

            <button
              type="button"
              disabled={isExportingZip || segments.length === 0}
              onClick={handleExportZip}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-98 disabled:opacity-40"
            >
              <Archive className="w-4 h-4" /> Tải Xuất File ZIP (MP3 + Transcript .TXT)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
