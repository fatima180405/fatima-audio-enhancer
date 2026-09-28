import { Mp3Encoder } from '@breezystack/lamejs';
import { ConversionSettings, ID3Tags } from '../types';
import { attachID3v2Tags } from './formatters';

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioContext = new AudioContextClass();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  
  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(
      arrayBuffer,
      (buffer) => resolve(buffer),
      (err) => reject(new Error(err?.message || 'Không thể giải mã file âm thanh này. Định dạng có thể bị lỗi hoặc không được hỗ trợ.'))
    ).catch(err => reject(err));
  });
}

/**
 * Linear interpolation resampler for AudioBuffer channel data
 */
function resampleChannelData(
  input: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate) return input;
  const ratio = sourceRate / targetRate;
  const targetLength = Math.round(input.length / ratio);
  const output = new Float32Array(targetLength);
  
  for (let i = 0; i < targetLength; i++) {
    const pos = i * ratio;
    const index = Math.floor(pos);
    const fraction = pos - index;
    const nextIndex = Math.min(index + 1, input.length - 1);
    output[i] = input[index] * (1 - fraction) + input[nextIndex] * fraction;
  }
  
  return output;
}

/**
 * SOLA (Synchronized Overlap-Add) Time-Stretching Algorithm
 * Changes audio playback speed / tempo smoothly while keeping the natural human pitch intact.
 * Uses normalized cross-correlation and raised-cosine crossfading to eliminate robotic phase cancellation.
 */
export function timeStretchAudioSOLA(
  left: Float32Array,
  right: Float32Array,
  speed: number,
  sampleRate: number
): { left: Float32Array; right: Float32Array } {
  if (Math.abs(speed - 1.0) < 0.005) {
    return { left, right };
  }

  const inputLength = left.length;
  if (inputLength === 0) return { left, right };

  const isStereo = right !== left && right.length === inputLength;
  const estimatedOutputLength = Math.max(1, Math.round(inputLength / speed));

  // Audio parameters:
  // Frame size N ~ 35ms (1024 or 2048)
  const N = Math.min(2048, Math.max(512, Math.pow(2, Math.round(Math.log2(sampleRate * 0.035)))));
  // Overlap length L ~ 15-20ms
  const L = Math.floor(N / 2);
  // Synthesis hop Ss
  const Ss = N - L;
  // Analysis hop Sa
  const Sa = Math.max(1, Math.round(Ss * speed));
  // Search range kMax
  const kMax = Math.floor(L / 2);

  // Pre-calculate mono mix for fast correlation
  const mono = new Float32Array(inputLength);
  for (let i = 0; i < inputLength; i++) {
    mono[i] = isStereo ? (left[i] + right[i]) * 0.5 : left[i];
  }

  // Pre-compute raised cosine crossfade window of length L for constant energy
  const fadeOut = new Float32Array(L);
  const fadeIn = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    const angle = (Math.PI * i) / L;
    const w = 0.5 * (1 - Math.cos(angle)); // 0 -> 1
    fadeIn[i] = w;
    fadeOut[i] = 1 - w;
  }

  // Allocate output buffers with safety margin
  const maxOut = estimatedOutputLength + N * 2;
  const outLeft = new Float32Array(maxOut);
  const outRight = isStereo ? new Float32Array(maxOut) : outLeft;

  // 1. Copy initial frame of length N
  const initLen = Math.min(N, inputLength);
  outLeft.set(left.subarray(0, initLen), 0);
  if (isStereo) {
    outRight.set(right.subarray(0, initLen), 0);
  }

  let outPos = Ss;
  let inPosTarget = Sa;
  let actualOutLen = initLen;

  while (inPosTarget + N <= inputLength && outPos + N <= maxOut) {
    // Search for best alignment k in [-kMax, kMax]
    const minK = -Math.min(kMax, inPosTarget);
    const maxK = Math.min(kMax, inputLength - N - inPosTarget);

    let bestK = 0;
    let maxCrossCorr = -Infinity;

    for (let k = minK; k <= maxK; k += 2) {
      let crossCorr = 0;
      let energy = 0;
      const inStart = inPosTarget + k;

      for (let j = 0; j < L; j += 4) {
        const outVal = isStereo ? (outLeft[outPos + j] + outRight[outPos + j]) * 0.5 : outLeft[outPos + j];
        const inVal = mono[inStart + j];
        crossCorr += outVal * inVal;
        energy += inVal * inVal;
      }

      const score = crossCorr / (Math.sqrt(energy + 1e-6) + 1e-4);
      if (score > maxCrossCorr) {
        maxCrossCorr = score;
        bestK = k;
      }
    }

    const actualInPos = inPosTarget + bestK;

    // Cross-fade the overlapping region of length L
    for (let j = 0; j < L; j++) {
      const oIdx = outPos + j;
      const iIdx = actualInPos + j;
      const fo = fadeOut[j];
      const fi = fadeIn[j];

      outLeft[oIdx] = outLeft[oIdx] * fo + left[iIdx] * fi;
      if (isStereo) {
        outRight[oIdx] = outRight[oIdx] * fo + right[iIdx] * fi;
      }
    }

    // Direct copy the non-overlapping portion of length (N - L) = Ss
    for (let j = L; j < N; j++) {
      const oIdx = outPos + j;
      const iIdx = actualInPos + j;
      if (oIdx < maxOut && iIdx < inputLength) {
        outLeft[oIdx] = left[iIdx];
        if (isStereo) {
          outRight[oIdx] = right[iIdx];
        }
      }
    }

    actualOutLen = Math.max(actualOutLen, outPos + N);
    outPos += Ss;
    inPosTarget += Sa;
  }

  return {
    left: outLeft.slice(0, actualOutLen),
    right: isStereo ? outRight.slice(0, actualOutLen) : outLeft.slice(0, actualOutLen),
  };
}

/**
 * Resampling Time-Stretching (Tape speed up/down, changes pitch proportionally)
 */
export function timeStretchResample(
  left: Float32Array,
  right: Float32Array,
  speed: number
): { left: Float32Array; right: Float32Array } {
  if (Math.abs(speed - 1.0) < 0.005) {
    return { left, right };
  }
  const isStereo = right !== left && right.length === left.length;
  const inLen = left.length;
  const outLen = Math.max(1, Math.round(inLen / speed));
  const outL = new Float32Array(outLen);
  const outR = isStereo ? new Float32Array(outLen) : outL;

  for (let i = 0; i < outLen; i++) {
    const srcPos = i * speed;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const next = Math.min(idx + 1, inLen - 1);
    outL[i] = left[idx] * (1 - frac) + left[next] * frac;
    if (isStereo) {
      outR[i] = right[idx] * (1 - frac) + right[next] * frac;
    }
  }
  return { left: outL, right: outR };
}

export function timeStretchAudio(
  left: Float32Array,
  right: Float32Array,
  speed: number,
  sampleRate: number,
  preservePitch = true
): { left: Float32Array; right: Float32Array } {
  if (Math.abs(speed - 1.0) < 0.005) {
    return { left, right };
  }
  if (!preservePitch) {
    return timeStretchResample(left, right, speed);
  }
  return timeStretchAudioSOLA(left, right, speed, sampleRate);
}

/**
 * Dynamic Soft-Knee Limiter (Anti-Clipping / Anti-Distortion)
 * Converts high amplitude signals smoothly using hyperbolic tangent (tanh).
 * Guarantees output stays strictly inside (-1.0, +1.0) without square wave clipping or crackling.
 */
export function applySoftLimiter(val: number): number {
  const absVal = Math.abs(val);
  if (absVal <= 0.7) {
    return val;
  }
  const over = absVal - 0.7;
  // Smooth logarithmic compression above 0.70 threshold up to peak ~0.99
  const compressed = 0.7 + 0.295 * Math.tanh(over / 0.7);
  return Math.sign(val) * Math.min(0.999, compressed);
}

/**
 * Audio Clarity Filter (High-Pass low noise cut + Speech Presence Boost)
 */
export class AudioClarityFilter {
  private prevInL = 0;
  private prevOutL = 0;
  private prevInR = 0;
  private prevOutR = 0;

  process(l: number, r: number, alpha = 0.988) {
    // 1. High pass filter (<80Hz rumble noise cut)
    const outL = alpha * (this.prevOutL + l - this.prevInL);
    this.prevInL = l;
    this.prevOutL = outL;

    const outR = alpha * (this.prevOutR + r - this.prevInR);
    this.prevInR = r;
    this.prevOutR = outR;

    // 2. High-frequency presence boost (~3kHz - 5kHz speech clarity)
    const diffL = outL - this.prevOutL;
    const diffR = outR - this.prevOutR;

    const boostedL = outL + diffL * 0.25;
    const boostedR = outR + diffR * 0.25;

    return { l: boostedL, r: boostedR };
  }
}

/**
 * Encodes decoded AudioBuffer to MP3 format using lamejs
 */
export async function convertBufferToMp3(
  buffer: AudioBuffer,
  settings: ConversionSettings,
  tags: ID3Tags,
  onProgress: (percentage: number) => void
): Promise<Blob> {
  const sourceSampleRate = buffer.sampleRate;
  const targetSampleRate = settings.sampleRate === 0 ? sourceSampleRate : settings.sampleRate;
  
  // Calculate start and end sample frames based on trim settings
  const startSec = Math.max(0, settings.startTime);
  const endSec = settings.endTime > 0 ? Math.min(buffer.duration, settings.endTime) : buffer.duration;
  
  const startSample = Math.floor(startSec * sourceSampleRate);
  const endSample = Math.min(buffer.length, Math.floor(endSec * sourceSampleRate));
  const sampleLength = Math.max(0, endSample - startSample);

  if (sampleLength <= 0) {
    throw new Error('Đoạn âm thanh được chọn có độ dài bằng 0.');
  }

  // Extract channels
  let leftChannel = buffer.getChannelData(0).slice(startSample, endSample);
  let rightChannel = buffer.numberOfChannels > 1 
    ? buffer.getChannelData(1).slice(startSample, endSample) 
    : leftChannel;

  // Apply speed / tempo stretch if speed !== 1.0 (e.g. 0.5x, 0.70x, 0.85x)
  const speed = settings.speed && settings.speed > 0 ? settings.speed : 1.0;
  if (Math.abs(speed - 1.0) >= 0.005) {
    const stretched = timeStretchAudio(
      leftChannel,
      rightChannel,
      speed,
      sourceSampleRate,
      settings.preservePitch !== false
    );
    leftChannel = stretched.left;
    rightChannel = stretched.right;
  }

  // Resample if target sample rate is different
  if (sourceSampleRate !== targetSampleRate) {
    leftChannel = resampleChannelData(leftChannel, sourceSampleRate, targetSampleRate);
    rightChannel = buffer.numberOfChannels > 1 
      ? resampleChannelData(rightChannel, sourceSampleRate, targetSampleRate) 
      : leftChannel;
  }

  const numOutputSamples = leftChannel.length;
  const isMono = settings.channels === 'mono' || buffer.numberOfChannels === 1;

  // Silence padding at start and/or end (e.g. 15s, 30s for IELTS listening / question pause)
  const padStartSec = Math.max(0, settings.padSilenceStart || 0);
  const padEndSec = Math.max(0, settings.padSilenceEnd || 0);
  const padStartSamples = Math.floor(padStartSec * targetSampleRate);
  const padEndSamples = Math.floor(padEndSec * targetSampleRate);
  const totalOutputSamples = padStartSamples + numOutputSamples + padEndSamples;

  // Process mono/stereo & apply Gain + Fade In / Out + Clarity Filter + Soft Limiter
  const leftPCM = new Int16Array(totalOutputSamples);
  const rightPCM = isMono ? leftPCM : new Int16Array(totalOutputSamples);

  const gain = settings.volume ?? 1.0;
  const fadeInSamples = Math.floor((settings.fadeInSeconds || 0) * targetSampleRate);
  const fadeOutSamples = Math.floor((settings.fadeOutSeconds || 0) * targetSampleRate);

  const useLimiter = settings.antiClippingLimiter !== false;
  const useClarity = settings.clarityEnhancer !== false;
  const filter = useClarity ? new AudioClarityFilter() : null;

  for (let i = 0; i < numOutputSamples; i++) {
    let fadeMultiplier = 1.0;
    
    if (fadeInSamples > 0 && i < fadeInSamples) {
      fadeMultiplier *= (i / fadeInSamples);
    }
    if (fadeOutSamples > 0 && i >= (numOutputSamples - fadeOutSamples)) {
      fadeMultiplier *= ((numOutputSamples - i) / fadeOutSamples);
    }

    const currentMultiplier = gain * Math.max(0, Math.min(1, fadeMultiplier));

    let lVal = leftChannel[i] * currentMultiplier;
    let rVal = rightChannel[i] * currentMultiplier;

    // 1. Audio Clarity Filter (High Pass + Presence Boost)
    if (filter) {
      const filtered = filter.process(lVal, rVal);
      lVal = filtered.l;
      rVal = filtered.r;
    }

    // 2. Soft-Knee Anti-Clipping Limiter (Soft saturation - zero crackle/distortion)
    if (useLimiter) {
      lVal = applySoftLimiter(lVal);
      rVal = applySoftLimiter(rVal);
    } else {
      lVal = Math.max(-1, Math.min(1, lVal));
      rVal = Math.max(-1, Math.min(1, rVal));
    }

    const destPos = padStartSamples + i;
    if (isMono) {
      const avg = (lVal + rVal) * 0.5;
      leftPCM[destPos] = avg < 0 ? avg * 0x8000 : avg * 0x7FFF;
    } else {
      leftPCM[destPos] = lVal < 0 ? lVal * 0x8000 : lVal * 0x7FFF;
      rightPCM[destPos] = rVal < 0 ? rVal * 0x8000 : rVal * 0x7FFF;
    }
  }

  // Initialize LAME MP3 Encoder
  const channels = isMono ? 1 : 2;
  const mp3encoder = new Mp3Encoder(channels, targetSampleRate, settings.bitrate);
  const mp3Data: Uint8Array[] = [];

  // Encode in chunks of 1152 samples to prevent UI thread blocking & report smooth progress
  const chunkSize = 1152;
  const totalChunks = Math.ceil(totalOutputSamples / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const offset = i * chunkSize;
    const end = Math.min(offset + chunkSize, totalOutputSamples);

    const leftSub = leftPCM.subarray(offset, end);
    let buf: Int8Array | Uint8Array;

    if (isMono) {
      buf = mp3encoder.encodeBuffer(leftSub);
    } else {
      const rightSub = rightPCM.subarray(offset, end);
      buf = mp3encoder.encodeBuffer(leftSub, rightSub);
    }

    if (buf.length > 0) {
      mp3Data.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    }

    // Report progress periodically and yield execution briefly
    if (i % 20 === 0 || i === totalChunks - 1) {
      const pct = Math.min(99, Math.round(((i + 1) / totalChunks) * 100));
      onProgress(pct);
      // Yield to main thread every 20 chunks
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Flush remaining buffer from encoder
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.byteLength));
  }

  // Combine chunks into single Uint8Array
  let totalLength = 0;
  for (const chunk of mp3Data) {
    totalLength += chunk.length;
  }

  const combinedMp3 = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of mp3Data) {
    combinedMp3.set(chunk, pos);
    pos += chunk.length;
  }

  // Attach ID3 tags if present
  const taggedMp3 = attachID3v2Tags(combinedMp3, tags);

  onProgress(100);
  return new Blob([taggedMp3], { type: 'audio/mp3' });
}

export interface MergeAudioTrackItem {
  file: File;
  buffer: AudioBuffer | null;
  settings: ConversionSettings;
  gapAfterSeconds?: number | null; // Khoảng lặng riêng sau track này (nếu null/undefined thì dùng gapSeconds chung)
}

/**
 * Merges multiple AudioBuffers into a single concatenated MP3 file.
 * Supports individual silence gap after each track as well as global gap.
 */
export async function mergeAudioItemsToMp3(
  items: MergeAudioTrackItem[],
  masterSettings: ConversionSettings,
  tags: ID3Tags,
  gapSeconds: number = 0,
  onProgress: (percentage: number) => void,
  padEndSeconds: number = 0
): Promise<Blob> {
  if (items.length === 0) {
    throw new Error('Cần chọn ít nhất 1 file để gộp.');
  }

  // 1. Ensure all items have decoded AudioBuffers
  const decodedBuffers: { buffer: AudioBuffer; settings: ConversionSettings; gapAfterSec: number }[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    let buf = item.buffer;
    if (!buf) {
      buf = await decodeAudioFile(item.file);
    }
    const isLast = idx === items.length - 1;
    let trackGap = 0;
    if (item.gapAfterSeconds !== undefined && item.gapAfterSeconds !== null) {
      trackGap = Math.max(0, item.gapAfterSeconds);
    } else {
      trackGap = isLast ? Math.max(0, padEndSeconds) : Math.max(0, gapSeconds);
    }
    decodedBuffers.push({ buffer: buf, settings: item.settings, gapAfterSec: trackGap });
  }

  // 2. Determine common target sample rate
  const targetSampleRate = masterSettings.sampleRate === 0
    ? decodedBuffers[0].buffer.sampleRate
    : masterSettings.sampleRate;

  // 3. Process each track (extract sliced subchannels, resample, apply track gain/fades)
  const processedTracks: { left: Float32Array; right: Float32Array; gapSamples: number }[] = [];
  let totalOutputSamples = 0;

  for (let idx = 0; idx < decodedBuffers.length; idx++) {
    const { buffer, settings, gapAfterSec } = decodedBuffers[idx];
    const sourceSampleRate = buffer.sampleRate;

    const startSec = Math.max(0, settings.startTime || 0);
    const endSec = settings.endTime > 0 ? Math.min(buffer.duration, settings.endTime) : buffer.duration;
    
    const startSample = Math.floor(startSec * sourceSampleRate);
    const endSample = Math.min(buffer.length, Math.floor(endSec * sourceSampleRate));
    const sampleLength = Math.max(0, endSample - startSample);

    if (sampleLength <= 0) continue;

    let leftChannel = buffer.getChannelData(0).slice(startSample, endSample);
    let rightChannel = buffer.numberOfChannels > 1
      ? buffer.getChannelData(1).slice(startSample, endSample)
      : leftChannel;

    const trackSpeed = settings.speed ?? masterSettings.speed ?? 1.0;
    if (Math.abs(trackSpeed - 1.0) >= 0.005) {
      const stretched = timeStretchAudio(
        leftChannel,
        rightChannel,
        trackSpeed,
        sourceSampleRate,
        settings.preservePitch !== false
      );
      leftChannel = stretched.left;
      rightChannel = stretched.right;
    }

    if (sourceSampleRate !== targetSampleRate) {
      leftChannel = resampleChannelData(leftChannel, sourceSampleRate, targetSampleRate);
      rightChannel = buffer.numberOfChannels > 1
        ? resampleChannelData(rightChannel, sourceSampleRate, targetSampleRate)
        : leftChannel;
    }

    const trackGain = settings.volume ?? masterSettings.volume ?? 1.0;
    const numSamples = leftChannel.length;

    const processedLeft = new Float32Array(numSamples);
    const processedRight = new Float32Array(numSamples);

    const useLimiter = settings.antiClippingLimiter !== false;
    const useClarity = settings.clarityEnhancer !== false;
    const filter = useClarity ? new AudioClarityFilter() : null;

    for (let i = 0; i < numSamples; i++) {
      let lVal = leftChannel[i] * trackGain;
      let rVal = rightChannel[i] * trackGain;

      if (filter) {
        const filtered = filter.process(lVal, rVal);
        lVal = filtered.l;
        rVal = filtered.r;
      }

      if (useLimiter) {
        lVal = applySoftLimiter(lVal);
        rVal = applySoftLimiter(rVal);
      } else {
        lVal = Math.max(-1, Math.min(1, lVal));
        rVal = Math.max(-1, Math.min(1, rVal));
      }

      processedLeft[i] = lVal;
      processedRight[i] = rVal;
    }

    const trackGapSamples = Math.floor(gapAfterSec * targetSampleRate);
    processedTracks.push({ left: processedLeft, right: processedRight, gapSamples: trackGapSamples });
    totalOutputSamples += numSamples + trackGapSamples;
  }

  if (totalOutputSamples <= 0) {
    throw new Error('Không có dữ liệu âm thanh hợp lệ để gộp.');
  }

  // 4. Concatenate into single stereo or mono array
  const isMono = masterSettings.channels === 'mono';
  const leftPCM = new Int16Array(totalOutputSamples);
  const rightPCM = isMono ? leftPCM : new Int16Array(totalOutputSamples);

  let writeOffset = 0;
  for (let idx = 0; idx < processedTracks.length; idx++) {
    const { left, right, gapSamples } = processedTracks[idx];
    const len = left.length;

    for (let i = 0; i < len; i++) {
      const pos = writeOffset + i;
      if (isMono) {
        const avg = (left[i] + right[i]) * 0.5;
        const scaled = Math.max(-1, Math.min(1, avg));
        leftPCM[pos] = scaled < 0 ? scaled * 0x8000 : scaled * 0x7FFF;
      } else {
        const lVal = Math.max(-1, Math.min(1, left[i]));
        const rVal = Math.max(-1, Math.min(1, right[i]));
        leftPCM[pos] = lVal < 0 ? lVal * 0x8000 : lVal * 0x7FFF;
        rightPCM[pos] = rVal < 0 ? rVal * 0x8000 : rVal * 0x7FFF;
      }
    }

    writeOffset += len;

    // Insert silence gap if configured for this track
    if (gapSamples > 0) {
      writeOffset += gapSamples; // zeros by default in Int16Array
    }
  }

  // 5. Encode combined PCM to MP3
  const channels = isMono ? 1 : 2;
  const mp3encoder = new Mp3Encoder(channels, targetSampleRate, masterSettings.bitrate);
  const mp3Data: Uint8Array[] = [];

  const chunkSize = 1152;
  const totalChunks = Math.ceil(totalOutputSamples / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const offset = i * chunkSize;
    const end = Math.min(offset + chunkSize, totalOutputSamples);

    const leftSub = leftPCM.subarray(offset, end);
    let buf: Int8Array | Uint8Array;

    if (isMono) {
      buf = mp3encoder.encodeBuffer(leftSub);
    } else {
      const rightSub = rightPCM.subarray(offset, end);
      buf = mp3encoder.encodeBuffer(leftSub, rightSub);
    }

    if (buf.length > 0) {
      mp3Data.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    }

    if (i % 25 === 0 || i === totalChunks - 1) {
      const pct = Math.min(99, Math.round(((i + 1) / totalChunks) * 100));
      onProgress(pct);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.byteLength));
  }

  let totalLength = 0;
  for (const chunk of mp3Data) {
    totalLength += chunk.length;
  }

  const combinedMp3 = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of mp3Data) {
    combinedMp3.set(chunk, pos);
    pos += chunk.length;
  }

  const taggedMp3 = attachID3v2Tags(combinedMp3, tags);
  onProgress(100);

  return new Blob([taggedMp3], { type: 'audio/mp3' });
}
