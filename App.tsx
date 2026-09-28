/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Sparkles, FileCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { AudioItem } from './components/AudioItem';
import { BatchSettingsBar } from './components/BatchSettingsBar';
import { AudioMergerModal } from './components/AudioMergerModal';
import { AudioSplitterModal } from './components/AudioSplitterModal';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import {
  AudioFileItem,
  BitrateOption,
  ChannelOption,
  ConversionSettings,
  ID3Tags,
  SampleRateOption,
} from './types';
import { convertBufferToMp3, decodeAudioFile } from './utils/audioEncoder';
import { getFileExtension } from './utils/formatters';

export default function App() {
  const [items, setItems] = useState<AudioFileItem[]>([]);
  const [globalBitrate, setGlobalBitrate] = useState<BitrateOption>(320);
  const [globalSampleRate, setGlobalSampleRate] = useState<SampleRateOption>(0);
  const [globalChannels, setGlobalChannels] = useState<ChannelOption>('stereo');
  const [globalVolume, setGlobalVolume] = useState<number>(1.0);
  const [globalSpeed, setGlobalSpeed] = useState<number>(1.0);
  const [globalClarityEnhancer, setGlobalClarityEnhancer] = useState<boolean>(true);
  const [globalAntiClippingLimiter, setGlobalAntiClippingLimiter] = useState<boolean>(true);
  const [isMergerOpen, setIsMergerOpen] = useState(false);
  const [splitterItem, setSplitterItem] = useState<AudioFileItem | null>(null);
  const [isConvertingAny, setIsConvertingAny] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleAddSegmentsToMainList = (newSegments: AudioFileItem[]) => {
    setItems((prev) => [...prev, ...newSegments]);
    showToast(`Đã thêm ${newSegments.length} câu nói vào danh sách chuyển đổi!`);
  };

  // Add files to state and automatically decode AudioBuffer
  const handleFilesAdded = async (newFiles: File[]) => {
    const newItems: AudioFileItem[] = newFiles.map((file) => {
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      return {
        id: Math.random().toString(36).substring(2, 11),
        file,
        name: file.name,
        originalFormat: getFileExtension(file.name),
        originalSize: file.size,
        duration: 0,
        audioBuffer: null,
        settings: {
          bitrate: globalBitrate,
          sampleRate: globalSampleRate,
          channels: globalChannels,
          volume: globalVolume,
          speed: globalSpeed,
          preservePitch: true,
          clarityEnhancer: globalClarityEnhancer,
          antiClippingLimiter: globalAntiClippingLimiter,
          startTime: 0,
          endTime: 0,
          fadeInSeconds: 0,
          fadeOutSeconds: 0,
        },
        tags: {
          title: baseName,
          artist: '',
          album: '',
          genre: 'Audio',
          year: new Date().getFullYear().toString(),
        },
        status: 'idle',
        progress: 0,
        convertedBlob: null,
        convertedUrl: null,
      };
    });

    setItems((prev) => [...prev, ...newItems]);

    // Asynchronously decode audio buffers
    for (const item of newItems) {
      try {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'decoding' } : i))
        );

        const buffer = await decodeAudioFile(item.file);

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  audioBuffer: buffer,
                  duration: buffer.duration,
                  status: 'idle',
                  settings: {
                    ...i.settings,
                    endTime: buffer.duration,
                  },
                }
              : i
          )
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Không thể đọc file âm thanh này.';
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  errorMessage: message,
                }
              : i
          )
        );
      }
    }
  };

  // Update per-item settings
  const handleUpdateSettings = (id: string, newSettings: Partial<ConversionSettings>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              settings: { ...item.settings, ...newSettings },
              // Reset completed state if settings change so user can reconvert
              status: item.status === 'completed' ? 'idle' : item.status,
            }
          : item
      )
    );
  };

  // Update per-item ID3 tags
  const handleUpdateTags = (id: string, tags: ID3Tags) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, tags } : item))
    );
  };

  // Remove single item
  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.convertedUrl) {
        URL.revokeObjectURL(target.convertedUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  // Clear all items
  const handleClearAll = () => {
    items.forEach((item) => {
      if (item.convertedUrl) {
        URL.revokeObjectURL(item.convertedUrl);
      }
    });
    setItems([]);
  };

  // Global option changes apply to all pending items
  const handleGlobalBitrateChange = (bitrate: BitrateOption) => {
    setGlobalBitrate(bitrate);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...item.settings, bitrate },
        status: item.status === 'completed' ? 'idle' : item.status,
      }))
    );
  };

  const handleGlobalSampleRateChange = (sampleRate: SampleRateOption) => {
    setGlobalSampleRate(sampleRate);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...item.settings, sampleRate },
        status: item.status === 'completed' ? 'idle' : item.status,
      }))
    );
  };

  const handleGlobalChannelsChange = (channels: ChannelOption) => {
    setGlobalChannels(channels);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...item.settings, channels },
        status: item.status === 'completed' ? 'idle' : item.status,
      }))
    );
  };

  const handleGlobalVolumeChange = (volume: number) => {
    setGlobalVolume(volume);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...item.settings, volume },
        status: item.status === 'completed' ? 'idle' : item.status,
      }))
    );
  };

  const handleGlobalSpeedChange = (speed: number) => {
    setGlobalSpeed(speed);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...item.settings, speed },
        status: item.status === 'completed' ? 'idle' : item.status,
      }))
    );
  };

  const handleGlobalClarityChange = (clarityEnhancer: boolean) => {
    setGlobalClarityEnhancer(clarityEnhancer);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...item.settings, clarityEnhancer },
        status: item.status === 'completed' ? 'idle' : item.status,
      }))
    );
  };

  const handleGlobalLimiterChange = (antiClippingLimiter: boolean) => {
    setGlobalAntiClippingLimiter(antiClippingLimiter);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...item.settings, antiClippingLimiter },
        status: item.status === 'completed' ? 'idle' : item.status,
      }))
    );
  };

  const handleApplyAllSilence = (settings: Partial<ConversionSettings>) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...item.settings, ...settings },
        status: item.status === 'completed' ? 'idle' : item.status,
      }))
    );
    showToast('Đã áp dụng khoảng lặng cho tất cả file!');
  };

  // Convert single audio file to MP3
  const handleConvertSingle = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      let buffer = item.audioBuffer;
      if (!buffer) {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: 'decoding', progress: 0 } : i))
        );
        buffer = await decodeAudioFile(item.file);
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, audioBuffer: buffer, status: 'converting', progress: 5 } : i
        )
      );

      const blob = await convertBufferToMp3(
        buffer,
        item.settings,
        item.tags,
        (progress) => {
          setItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, progress } : i))
          );
        }
      );

      const url = URL.createObjectURL(blob);

      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'completed',
                progress: 100,
                convertedBlob: blob,
                convertedUrl: url,
                convertedSize: blob.size,
              }
            : i
        )
      );

      showToast(`Đã chuyển đổi xong "${item.name}" sang MP3!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi mã hóa MP3.';
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'error',
                errorMessage: message,
              }
            : i
        )
      );
    }
  };

  // Convert all items
  const handleConvertAll = async () => {
    setIsConvertingAny(true);
    const targetItems = items.filter((i) => i.status !== 'completed');

    for (const item of targetItems) {
      await handleConvertSingle(item.id);
    }

    setIsConvertingAny(false);
    showToast('Hoàn thành chuyển đổi tất cả file!');
  };

  // Download all converted files as ZIP
  const handleDownloadZip = async () => {
    const completedItems = items.filter((i) => i.status === 'completed' && i.convertedBlob);
    if (completedItems.length === 0) return;

    showToast('Đang tạo file .ZIP...');
    const zip = new JSZip();

    completedItems.forEach((item) => {
      if (item.convertedBlob) {
        const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        zip.file(`${baseName}.mp3`, item.convertedBlob);
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `Audio_MP3_Converted_${new Date().getTime()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('Đã tải xuống file .ZIP thành công!');
  };

  const totalCount = items.length;
  const completedCount = items.filter((i) => i.status === 'completed').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Header Navigation */}
      <Header totalFiles={totalCount} completedFiles={completedCount} />

      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {/* App Hero Title */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Chuyển Đổi MP3 & Tăng Âm Lượng Audio Trực Tuyến
          </h2>
          <p className="text-sm text-slate-600 font-medium">
            Hỗ trợ đổi <strong className="text-indigo-600">.WAV, .OGG, .FLAC, .M4A, .AAC, .WEBM</strong> sang <strong>MP3 (320Kbps)</strong>, <strong className="text-sky-600">chỉnh tốc độ tinh chỉnh (0.85x–0.9x IELTS)</strong>, <strong className="text-amber-600">tách câu tự động theo khoảng lặng (VAD)</strong>, gộp file & kích âm lượng lên tới 400%.
          </p>
        </div>

        {/* Dropzone Upload Component */}
        <Dropzone
          onFilesAdded={handleFilesAdded}
          selectedBitrate={globalBitrate}
          onBitrateChange={handleGlobalBitrateChange}
        />

        {/* Uploaded Audio Items List & Batch Settings */}
        {totalCount > 0 && (
          <div className="mt-8 space-y-4">
            <BatchSettingsBar
              totalCount={totalCount}
              completedCount={completedCount}
              isConvertingAny={isConvertingAny}
              globalBitrate={globalBitrate}
              globalSampleRate={globalSampleRate}
              globalChannels={globalChannels}
              globalVolume={globalVolume}
              globalSpeed={globalSpeed}
              globalClarityEnhancer={globalClarityEnhancer}
              globalAntiClippingLimiter={globalAntiClippingLimiter}
              onBitrateChange={handleGlobalBitrateChange}
              onSampleRateChange={handleGlobalSampleRateChange}
              onChannelsChange={handleGlobalChannelsChange}
              onVolumeChange={handleGlobalVolumeChange}
              onSpeedChange={handleGlobalSpeedChange}
              onClarityChange={handleGlobalClarityChange}
              onLimiterChange={handleGlobalLimiterChange}
              onOpenMerger={() => setIsMergerOpen(true)}
              onConvertAll={handleConvertAll}
              onDownloadZip={handleDownloadZip}
              onClearAll={handleClearAll}
            />

            <div className="space-y-3">
              {items.map((item) => (
                <AudioItem
                  key={item.id}
                  item={item}
                  onConvert={handleConvertSingle}
                  onRemove={handleRemove}
                  onUpdateSettings={handleUpdateSettings}
                  onUpdateTags={handleUpdateTags}
                  onOpenSplitter={(selectedItem) => setSplitterItem(selectedItem)}
                  onApplyAllSilence={handleApplyAllSilence}
                />
              ))}
            </div>
          </div>
        )}

        {/* FAQ & Format Features */}
        <FaqSection />
      </main>

      {/* Audio Merger Modal */}
      <AudioMergerModal
        isOpen={isMergerOpen}
        onClose={() => setIsMergerOpen(false)}
        items={items}
        globalBitrate={globalBitrate}
        globalVolume={globalVolume}
      />

      {/* Smart Audio Splitter Modal */}
      <AudioSplitterModal
        isOpen={!!splitterItem}
        onClose={() => setSplitterItem(null)}
        item={splitterItem}
        globalBitrate={globalBitrate}
        globalVolume={globalVolume}
        onAddSegmentsToMainList={handleAddSegmentsToMainList}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
