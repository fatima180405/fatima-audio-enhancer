export type BitrateOption = 64 | 128 | 192 | 256 | 320;
export type SampleRateOption = 0 | 22050 | 32000 | 44100 | 48000; // 0 = Keep Original
export type ChannelOption = 'stereo' | 'mono';

export interface ID3Tags {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
}

export interface ConversionSettings {
  bitrate: BitrateOption;
  sampleRate: SampleRateOption;
  channels: ChannelOption;
  volume: number; // 0.5 to 4.0 (1.0 = 100%)
  startTime: number; // in seconds
  endTime: number; // in seconds (0 = full duration)
  fadeInSeconds: number; // 0 to 5
  fadeOutSeconds: number; // 0 to 5
  clarityEnhancer?: boolean; // Enable high-pass noise cut & presence boost (Làm trong giọng)
  antiClippingLimiter?: boolean; // Enable soft-knee limiter (Chống rè/vỡ tiếng khi kích âm lượng)
  speed?: number; // Playback / encoding speed multiplier (0.5 to 2.0)
  preservePitch?: boolean; // Keep pitch intact using WSOLA time-stretch (true by default)
  padSilenceEnd?: number; // Khoảng lặng thêm vào cuối file (giây) - ví dụ 15s, 30s, 45s, 60s
  padSilenceStart?: number; // Khoảng lặng thêm vào đầu file (giây)
}

export type ConversionStatus = 'idle' | 'decoding' | 'converting' | 'completed' | 'error';

export interface AudioFileItem {
  id: string;
  file: File;
  name: string;
  originalFormat: string;
  originalSize: number; // bytes
  duration: number; // seconds
  audioBuffer: AudioBuffer | null;
  settings: ConversionSettings;
  tags: ID3Tags;
  status: ConversionStatus;
  progress: number; // 0 to 100
  errorMessage?: string;
  convertedBlob: Blob | null;
  convertedUrl: string | null;
  convertedSize?: number;
}
