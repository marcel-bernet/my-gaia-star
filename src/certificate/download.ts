/** Saving the rendered certificate as a PNG or an A4 PDF. */

export async function downloadPng(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
  await save(blob, filename, 'image/png');
}

export async function downloadPdf(canvas: HTMLCanvasElement, filename: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  await save(pdf.output('blob'), filename, 'application/pdf');
}

/** On phones, hand the file to the share sheet (save to Photos/Files, send…); elsewhere, download it. */
export async function save(blob: Blob, filename: string, type: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'; // user closed the sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
