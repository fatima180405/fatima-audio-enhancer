import { ConversionSettings, ID3Tags } from '../types';
import { convertBufferToMp3 } from './audioEncoder';

export interface Segment {
  id: string;
  index: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number; // in seconds
  blob?: Blob;
  url?: string;
  transcript?: string;
  status?: 'idle' | 'converting' | 'completed' | 'error';
}

export interface SplitterOptions {
  silenceThresholdDb: number; // -50 to -20 dB (default -35dB)
  minSilenceDuration: number; // seconds (default 0.4s)
  minSpeechDuration: number; // seconds (default 0.5s)
  paddingDuration: number; // seconds added to start/end (default 0.15s)
  maxSpeechDuration?: number; // max length in seconds for any segment (e.g. 6.0s)
}

/**
 * Detects speech segments in an AudioBuffer based on RMS energy thresholding
 */
export function detectSpeechSegments(
  buffer: AudioBuffer,
  options: SplitterOptions
): Segment[] {
  const { silenceThresholdDb, minSilenceDuration, minSpeechDuration, paddingDuration } = options;
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0); // Analyze mono or left channel

  // Convert dB threshold to linear amplitude threshold
  // dB = 20 * log10(amplitude) => amplitude = 10^(dB/20)
  const thresholdAmp = Math.pow(10, silenceThresholdDb / 20);

  // Use frame size of ~10ms (e.g. 441 samples at 44.1kHz)
  const frameSize = Math.floor(sampleRate * 0.01);
  const numFrames = Math.floor(channelData.length / frameSize);

  // Compute RMS for each frame
  const isSpeechFrame: boolean[] = new Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSize;
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const sample = channelData[start + i];
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    isSpeechFrame[f] = rms >= thresholdAmp;
  }

  const frameDuration = frameSize / sampleRate;
  const minSilenceFrames = Math.ceil(minSilenceDuration / frameDuration);
  const minSpeechFrames = Math.ceil(minSpeechDuration / frameDuration);

  // Initial pass: group raw speech frames
  const rawSegments: { startFrame: number; endFrame: number }[] = [];
  let inSpeech = false;
  let speechStart = 0;
  let silenceCounter = 0;

  for (let f = 0; f < numFrames; f++) {
    if (isSpeechFrame[f]) {
      if (!inSpeech) {
        inSpeech = true;
        speechStart = f;
      }
      silenceCounter = 0;
    } else {
      if (inSpeech) {
        silenceCounter++;
        if (silenceCounter >= minSilenceFrames) {
          // Speech ended
          const speechEnd = f - silenceCounter;
          if (speechEnd - speechStart >= minSpeechFrames) {
            rawSegments.push({ startFrame: speechStart, endFrame: speechEnd });
          }
          inSpeech = false;
          silenceCounter = 0;
        }
      }
    }
  }

  // Handle case where audio ends during speech
  if (inSpeech) {
    const speechEnd = numFrames - 1;
    if (speechEnd - speechStart >= minSpeechFrames) {
      rawSegments.push({ startFrame: speechStart, endFrame: speechEnd });
    }
  }

  // Convert frame indices to time in seconds and apply padding
  const maxDur = options.maxSpeechDuration || 0;
  const totalDuration = buffer.duration;
  const initialSegments: { startTime: number; endTime: number }[] = [];

  rawSegments.forEach((seg) => {
    let startSec = Math.max(0, seg.startFrame * frameDuration - paddingDuration);
    let endSec = Math.min(totalDuration, seg.endFrame * frameDuration + paddingDuration);
    const dur = endSec - startSec;

    if (maxDur > 0 && dur > maxDur) {
      // Split into parts each <= maxDur
      const numParts = Math.ceil(dur / maxDur);
      const partLength = dur / numParts;
      for (let p = 0; p < numParts; p++) {
        const pStart = startSec + p * partLength;
        const pEnd = Math.min(endSec, startSec + (p + 1) * partLength);
        initialSegments.push({ startTime: pStart, endTime: pEnd });
      }
    } else {
      initialSegments.push({ startTime: startSec, endTime: endSec });
    }
  });

  const segments: Segment[] = initialSegments.map((seg, idx) => {
    const dur = Math.max(0.1, seg.endTime - seg.startTime);

    return {
      id: `seg_${Math.random().toString(36).substring(2, 9)}`,
      index: idx + 1,
      startTime: Number(seg.startTime.toFixed(2)),
      endTime: Number(seg.endTime.toFixed(2)),
      duration: Number(dur.toFixed(2)),
      status: 'idle',
    };
  });

  return segments;
}

/**
 * Cuts an individual segment from AudioBuffer and converts it to MP3 Blob
 */
export async function exportSegmentToMp3(
  buffer: AudioBuffer,
  segment: Segment,
  bitrate: number,
  volume: number,
  tags: ID3Tags,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const settings: ConversionSettings = {
    bitrate: bitrate as any,
    sampleRate: 0,
    channels: 'stereo',
    volume,
    startTime: segment.startTime,
    endTime: segment.endTime,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
  };

  const segmentTags: ID3Tags = {
    ...tags,
    title: `${tags.title || 'Cau'} - Đoạn ${segment.index}`,
  };

  return convertBufferToMp3(buffer, settings, segmentTags, (pct) => {
    if (onProgress) onProgress(pct);
  });
}
