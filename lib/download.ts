/** Save an export through the desktop shell's native dialog or a browser download. */
export async function saveBlob(blob: Blob, filename: string): Promise<boolean> {
  const desktop = window.brigxDesktop;
  if (desktop) {
    const result = await desktop.saveFile({
      defaultName: filename,
      mimeType: blob.type || 'application/octet-stream',
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });
    return !result.cancelled;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel downloads in Safari and embedded browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
