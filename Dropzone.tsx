import React, { useRef, useState } from 'react';
import { Upload, FileAudio, Sparkles, CheckCircle2, Music2, ShieldAlert } from 'lucide-react';
import { BitrateOption } from '../types';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  selectedBitrate: BitrateOption;
  onBitrateChange: (bitrate: BitrateOption) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesAdded,
  selectedBitrate,
  onBitrateChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((file: File) =>
        file.type.startsWith('audio/') ||
        /\.(wav|ogg|flac|m4a|aac|webm|wma|aiff|mp3|m4r|opus|mp4)$/i.test(file.name)
      );
      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  // Generate a synthesized test WAV file so the user can test immediately
  const handleLoadSampleWav = async () => {
    setIsDemoLoading(true);
    try {
      // Create a 3-second synth audio buffer
      const sampleRate = 44100;
      const duration = 3;
      const numSamples = sampleRate * duration;
      const buffer = new Float32Array(numSamples);

      // Simple pleasant chord/melody synthesis
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // C major arpeggio + sine wave
        const freq = t < 1 ? 261.63 : t < 2 ? 329.63 : 392.0;
        const envelope = Math.sin((i / numSamples) * Math.PI); // smooth fade
        buffer[i] = Math.sin(2 * Math.PI * freq * t) * 0.5 * envelope;
      }

      // Convert to WAV Blob
      const wavHeader = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(wavHeader);

      /* RIFF identifier */
      view.setUint32(0, 0x52494646, false);
      /* file length */
      view.setUint32(4, 36 + numSamples * 2, true);
      /* RIFF type */
      view.setUint32(8, 0x57415645, false);
      /* format chunk identifier */
      view.setUint32(12, 0x666d7420, false);
      /* format chunk length */
      view.setUint32(16, 16, true);
      /* sample format (pcm) */
      view.setUint16(20, 1, true);
      /* channel count (mono) */
      view.setUint16(22, 1, true);
      /* sample rate */
      view.setUint32(24, sampleRate, true);
      /* byte rate */
      view.setUint32(28, sampleRate * 2, true);
      /* block align */
      view.setUint16(32, 2, true);
      /* bits per sample */
      view.setUint16(34, 16, true);
      /* data chunk identifier */
      view.setUint32(36, 0x64617461, false);
      /* data chunk length */
      view.setUint32(40, numSamples * 2, true);

      // Write PCM 16-bit samples
      for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]));
        const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(44 + i * 2, val, true);
      }

      const sampleBlob = new Blob([view], { type: 'audio/wav' });
      const sampleFile = new File([sampleBlob], 'sample_synth_melody.wav', { type: 'audio/wav' });

      onFilesAdded([sampleFile]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Main Drag-and-Drop Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01] shadow-xl'
            : 'border-slate-300 hover:border-indigo-400 bg-gradient-to-b from-white to-slate-50/60 shadow-xs hover:shadow-md'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.wav,.ogg,.flac,.m4a,.aac,.webm,.wma,.aiff,.mp3,.m4r,.opus,.mp4"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center justify-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
            <Upload className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-1">
            Kéo thả âm thanh vào đây hoặc <span className="text-indigo-600 underline underline-offset-4">Chọn File</span>
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Hỗ trợ tất cả định dạng: <strong>WAV, OGG, FLAC, M4A, AAC, WEBM, WMA, AIFF, MP3</strong>
          </p>

          {/* Supported Formats Pill Bar */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-6 text-xs font-semibold text-slate-600">
            {['.WAV', '.OGG', '.FLAC', '.M4A', '.AAC', '.WEBM', '.AIFF', '.WMA'].map((ext) => (
              <span
                key={ext}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs group-hover:border-indigo-200 transition-colors"
              >
                {ext}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
            >
              <FileAudio className="w-4 h-4" />
              Tải File Lên
            </button>

            <button
              type="button"
              disabled={isDemoLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleLoadSampleWav();
              }}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all shadow-2xs flex items-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              {isDemoLoading ? 'Đang tạo mẫu...' : 'Thử File Mẫu (.WAV)'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Bitrate Quality Presets Bar */}
      <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Music2 className="w-4 h-4 text-indigo-600" />
          <span>Mức chất lượng MP3 mặc định:</span>
        </div>

        <div className="flex items-center gap-1.5">
          {(
            [
              { kbps: 320, label: '320 Kbps', sub: 'Chất lượng cao nhất' },
              { kbps: 256, label: '256 Kbps', sub: 'Rất tốt' },
              { kbps: 192, label: '192 Kbps', sub: 'Chuẩn tiêu chuẩn' },
              { kbps: 128, label: '128 Kbps', sub: 'Nhẹ & Tiết kiệm' },
            ] as const
          ).map((preset) => {
            const isSelected = selectedBitrate === preset.kbps;
            return (
              <button
                key={preset.kbps}
                type="button"
                onClick={() => onBitrateChange(preset.kbps as BitrateOption)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
