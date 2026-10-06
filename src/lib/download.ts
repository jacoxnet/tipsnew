/** Trigger a browser download of `content` */
export function downloadText(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>;
}

let lastHandle: FileSystemFileHandle | null = null;

/**
 * Save JSON using the File System Access API when available (remembering the
 * file name for next time), otherwise as a download. Returns false if the user cancelled.
 */
export async function saveJsonFile(content: string, suggestedName: string): Promise<boolean> {
  const w = window as unknown as SaveFilePickerWindow;
  if (w.showSaveFilePicker) {
    try {
      lastHandle = await w.showSaveFilePicker({
        suggestedName: lastHandle ? lastHandle.name : suggestedName,
        startIn: 'downloads',
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await lastHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      throw err;
    }
  }
  downloadText(content, suggestedName, 'application/json;charset=utf-8');
  return true;
}
