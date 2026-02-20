/**
 * Compressor - Stub module for message compression
 */

export type CompressionMode = 'none' | 'gzip' | 'deflate';

export class Compressor {
  private mode: CompressionMode;

  constructor(mode: CompressionMode = 'none') {
    this.mode = mode;
  }

  async compress(data: string): Promise<string | ArrayBuffer> {
    if (this.mode === 'none') {
      return data;
    }

    // Use native CompressionStream if available
    if (typeof CompressionStream !== 'undefined' && this.mode === 'gzip') {
      const encoder = new TextEncoder();
      const input = encoder.encode(data);
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(input);
      writer.close();

      const chunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result.buffer;
    }

    return data;
  }

  async decompress(data: string | ArrayBuffer): Promise<string> {
    if (typeof data === 'string') {
      return data;
    }

    // Stub: return empty string for non-string data
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }

  getMode(): CompressionMode {
    return this.mode;
  }
}
