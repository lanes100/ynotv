/**
 * EPG Parser Web Worker
 * Handles decompression and parsing of XMLTV data off the main thread
 */

import { parseXmltv, type XmltvProgram } from '@ynotv/local-adapter';

export interface EpgWorkerMessage {
  type: 'parse';
  id: number;
  data?: string;        // Raw XML text or base64 gzipped data
  buffer?: Uint8Array;  // Transferred buffer (for large data)
  isBuffer?: boolean;   // True if using buffer instead of string
  isGzipped: boolean;
  includeRawXml?: boolean; // If true, return the (decompressed) XML text back
}

export interface EpgWorkerResponse {
  type: 'result' | 'error';
  id: number;
  programs?: XmltvProgram[];
  rawXml?: string;
  error?: string;
}

// Decompress gzipped data
async function decompressGzip(data: Uint8Array | string): Promise<string> {
  let bytes: Uint8Array;
  
  if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    // Legacy base64 support
    const binaryString = atob(data);
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  }

  const ds = new DecompressionStream('gzip');
  const decompressedStream = new Blob([bytes as any]).stream().pipeThrough(ds);
  const decompressedBlob = await new Response(decompressedStream).blob();
  return await decompressedBlob.text();
}

self.onmessage = async (event: MessageEvent<EpgWorkerMessage>) => {
  const { type, id, data, buffer, isBuffer, isGzipped, includeRawXml } = event.data;

  if (type !== 'parse') return;

  try {
    let xmlText: string;

    if (isGzipped) {
      // If gzipped, the input must be treated as binary bytes.
      let binaryInput: Uint8Array | string;
      if (isBuffer && buffer) {
        binaryInput = buffer;
      } else if (data) {
        binaryInput = data;
      } else {
        throw new Error('No data provided');
      }
      xmlText = await decompressGzip(binaryInput);
      console.log(`[EPG Worker] Decompressed gzip. Length: ${xmlText.length}. Starts with: ${xmlText.substring(0, 200)}`);
    } else {
      // Not gzipped, so it's a string.
      let inputData: string;
      if (isBuffer && buffer) {
        // Decode transferred buffer back to string
        const decoder = new TextDecoder();
        inputData = decoder.decode(buffer);
      } else if (data) {
        inputData = data;
      } else {
        throw new Error('No data provided');
      }
      xmlText = inputData;
    }

    const programs = parseXmltv(xmlText);

    const response: EpgWorkerResponse = {
      type: 'result',
      id,
      programs,
    };

    if (includeRawXml) {
      response.rawXml = xmlText;
    }

    self.postMessage(response);
  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      error: err instanceof Error ? err.message : String(err),
    } as EpgWorkerResponse);
  }
};
