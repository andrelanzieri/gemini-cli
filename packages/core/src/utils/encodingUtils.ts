/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

export interface EncodingSettings {
  defaultEncoding?: string;
  extensionMappings?: Record<string, string>;
  autoDetectEncoding?: boolean;
}

export const DEFAULT_ENCODING_SETTINGS: EncodingSettings = {
  defaultEncoding: 'utf-8',
  extensionMappings: {
    '.prw': 'latin1',
    '.tlpp': 'latin1',
  },
  autoDetectEncoding: false,
};

/**
 * Gets the appropriate encoding for a file based on its extension and settings
 */
export function getEncodingForFile(
  filePath: string,
  settings?: EncodingSettings
): string {
  const effectiveSettings = { ...DEFAULT_ENCODING_SETTINGS, ...settings };
  const extension = path.extname(filePath).toLowerCase();

  // Check if there's a specific mapping for this extension
  if (effectiveSettings.extensionMappings?.[extension]) {
    return effectiveSettings.extensionMappings[extension];
  }

  // Fall back to default encoding
  return effectiveSettings.defaultEncoding || 'utf-8';
}

/**
 * Attempts to detect the encoding of a file by examining its content
 */
export function detectEncoding(buffer: Buffer): string {
  // Check for BOM (Byte Order Mark)
  if (buffer.length >= 3) {
    // UTF-8 BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf-8';
    }
  }

  if (buffer.length >= 2) {
    // UTF-16 LE BOM
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'utf-16le';
    }
    // UTF-16 BE BOM
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'utf-16be';
    }
  }

  // Heuristic detection for Windows-1252 vs UTF-8
  // Check for high-bit characters that would be invalid in UTF-8
  let hasHighBitChars = false;
  let hasInvalidUtf8Sequences = false;

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    if (byte > 127) {
      hasHighBitChars = true;

      // Check if this could be a valid UTF-8 sequence
      if (byte >= 0xC0 && byte <= 0xDF && i + 1 < buffer.length) {
        // 2-byte sequence
        const next = buffer[i + 1];
        if (next < 0x80 || next > 0xBF) {
          hasInvalidUtf8Sequences = true;
          break;
        }
        i++;
      } else if (byte >= 0xE0 && byte <= 0xEF && i + 2 < buffer.length) {
        // 3-byte sequence
        const next1 = buffer[i + 1];
        const next2 = buffer[i + 2];
        if ((next1 < 0x80 || next1 > 0xBF) || (next2 < 0x80 || next2 > 0xBF)) {
          hasInvalidUtf8Sequences = true;
          break;
        }
        i += 2;
      } else if (byte >= 0xF0 && byte <= 0xF7 && i + 3 < buffer.length) {
        // 4-byte sequence
        const next1 = buffer[i + 1];
        const next2 = buffer[i + 2];
        const next3 = buffer[i + 3];
        if ((next1 < 0x80 || next1 > 0xBF) ||
          (next2 < 0x80 || next2 > 0xBF) ||
          (next3 < 0x80 || next3 > 0xBF)) {
          hasInvalidUtf8Sequences = true;
          break;
        }
        i += 3;
      } else if (byte >= 0x80 && byte <= 0xBF) {
        // Continuation byte without lead byte
        hasInvalidUtf8Sequences = true;
        break;
      } else if (byte >= 0xC0) {
        // Invalid UTF-8 start byte
        hasInvalidUtf8Sequences = true;
        break;
      }
    }
  }

  // If we have high-bit characters and invalid UTF-8 sequences,
  // it's probably Windows-1252 or another single-byte encoding
  if (hasHighBitChars && hasInvalidUtf8Sequences) {
    return 'latin1';
  }

  // Default to UTF-8 if no clear indicators
  return 'utf-8';
}

/**
 * Reads a file with the specified encoding, or auto-detects if enabled
 */
export function readFileWithEncoding(
  filePath: string,
  settings?: EncodingSettings
): string {
  const effectiveSettings = { ...DEFAULT_ENCODING_SETTINGS, ...settings };

  // Read file as buffer first
  const buffer = fs.readFileSync(filePath);

  let encoding: string;

  if (effectiveSettings.autoDetectEncoding) {
    encoding = detectEncoding(buffer);
  } else {
    encoding = getEncodingForFile(filePath, effectiveSettings);
  }

  // Convert buffer to string using the determined encoding
  if (encoding === 'utf-8' || encoding === 'utf8') {
    return buffer.toString('utf8');
  } else {
    return iconv.decode(buffer, encoding);
  }
}

/**
 * Writes a file with the specified encoding
 */
export function writeFileWithEncoding(
  filePath: string,
  content: string,
  settings?: EncodingSettings
): void {
  const effectiveSettings = { ...DEFAULT_ENCODING_SETTINGS, ...settings };
  const encoding = getEncodingForFile(filePath, effectiveSettings);

  let buffer: Buffer;

  if (encoding === 'utf-8' || encoding === 'utf8') {
    buffer = Buffer.from(content, 'utf8');
  } else {
    buffer = iconv.encode(content, encoding);
  }

  fs.writeFileSync(filePath, buffer);
}

/**
 * Asynchronously reads a file with the specified encoding
 */
export async function readFileWithEncodingAsync(
  filePath: string,
  settings?: EncodingSettings
): Promise<string> {
  const effectiveSettings = { ...DEFAULT_ENCODING_SETTINGS, ...settings };

  // Read file as buffer first
  const buffer = await fs.promises.readFile(filePath);

  let encoding: string;

  if (effectiveSettings.autoDetectEncoding) {
    encoding = detectEncoding(buffer);
  } else {
    encoding = getEncodingForFile(filePath, effectiveSettings);
  }

  // Convert buffer to string using the determined encoding
  if (encoding === 'utf-8' || encoding === 'utf8') {
    return buffer.toString('utf8');
  } else {
    return iconv.decode(buffer, encoding);
  }
}

/**
 * Asynchronously writes a file with the specified encoding
 */
export async function writeFileWithEncodingAsync(
  filePath: string,
  content: string,
  settings?: EncodingSettings
): Promise<void> {
  const effectiveSettings = { ...DEFAULT_ENCODING_SETTINGS, ...settings };
  const encoding = getEncodingForFile(filePath, effectiveSettings);

  let buffer: Buffer;

  if (encoding === 'utf-8' || encoding === 'utf8') {
    buffer = Buffer.from(content, 'utf8');
  } else {
    buffer = iconv.encode(content, encoding);
  }

  await fs.promises.writeFile(filePath, buffer);
}

/**
 * Lists all supported encodings
 */
export function getSupportedEncodings(): string[] {
  return [
    'utf-8',
    'utf-16le',
    'utf-16be',
    'latin1',
    'iso-8859-1',
    'ascii',
    'binary',
  ];
}