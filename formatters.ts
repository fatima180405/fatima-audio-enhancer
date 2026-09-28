import { ID3Tags } from '../types';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
  const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const formattedRemMins = remMins < 10 ? `0${remMins}` : `${remMins}`;
    return `${hrs}:${formattedRemMins}:${formattedSecs}`;
  }
  
  return `${formattedMins}:${formattedSecs}`;
}

export function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  return ext ? ext.toUpperCase() : 'AUDIO';
}

/**
 * Builds a simple ID3v2.3 tag header to prepend to MP3 binary data
 */
export function attachID3v2Tags(mp3Bytes: Uint8Array, tags: ID3Tags): Uint8Array {
  const frames: Uint8Array[] = [];

  const createFrame = (id: string, text: string): Uint8Array | null => {
    if (!text || !text.trim()) return null;
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    // 1 byte encoding flag (0 = ISO-8859-1 / ASCII) + text bytes
    const contentLen = 1 + textBytes.length;
    
    const frame = new Uint8Array(10 + contentLen);
    // 4 bytes ID
    for (let i = 0; i < 4; i++) {
      frame[i] = id.charCodeAt(i);
    }
    // 4 bytes size (big endian)
    frame[4] = (contentLen >> 24) & 0xFF;
    frame[5] = (contentLen >> 16) & 0xFF;
    frame[6] = (contentLen >> 8) & 0xFF;
    frame[7] = contentLen & 0xFF;
    // 2 bytes flags
    frame[8] = 0;
    frame[9] = 0;
    // content
    frame[10] = 0; // ISO-8859-1
    frame.set(textBytes, 11);
    
    return frame;
  };

  if (tags.title) {
    const f = createFrame('TIT2', tags.title);
    if (f) frames.push(f);
  }
  if (tags.artist) {
    const f = createFrame('TPE1', tags.artist);
    if (f) frames.push(f);
  }
  if (tags.album) {
    const f = createFrame('TALB', tags.album);
    if (f) frames.push(f);
  }
  if (tags.genre) {
    const f = createFrame('TCON', tags.genre);
    if (f) frames.push(f);
  }
  if (tags.year) {
    const f = createFrame('TYER', tags.year);
    if (f) frames.push(f);
  }

  if (frames.length === 0) {
    return mp3Bytes;
  }

  let totalFramesLen = 0;
  for (const f of frames) {
    totalFramesLen += f.length;
  }

  // ID3v2 header is 10 bytes + syncsafe size
  const header = new Uint8Array(10);
  header[0] = 0x49; // 'I'
  header[1] = 0x44; // 'D'
  header[2] = 0x33; // '3'
  header[3] = 3;    // version 2.3
  header[4] = 0;    // revision
  header[5] = 0;    // flags

  // Convert size to 28-bit syncsafe integer
  let size = totalFramesLen;
  header[6] = (size >> 21) & 0x7F;
  header[7] = (size >> 14) & 0x7F;
  header[8] = (size >> 7) & 0x7F;
  header[9] = size & 0x7F;

  const result = new Uint8Array(10 + totalFramesLen + mp3Bytes.length);
  result.set(header, 0);
  
  let offset = 10;
  for (const f of frames) {
    result.set(f, offset);
    offset += f.length;
  }
  
  result.set(mp3Bytes, offset);
  return result;
}
