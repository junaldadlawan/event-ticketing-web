/**
 * Turns the rendered report into an A4 PDF and downloads it. Each block of the report (the header and every section) is drawn
 * as a picture and placed in order; a block that does not fit the rest of a page starts the next one. The libraries load
 * only when this runs.
 */
export async function downloadReportPdf(root: HTMLElement, filename: string): Promise<void> {
  const [{ jsPDF }, { toJpeg }] = await Promise.all([import('jspdf'), import('html-to-image')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const width = pageW - margin * 2;
  const usable = pageH - margin * 2;
  let y = margin;

  const blocks = [...root.querySelectorAll<HTMLElement>('.report-head, .report-section')];
  for (const block of blocks) {
    const data = await toJpeg(block, { quality: 0.85, pixelRatio: 1.5, backgroundColor: '#ffffff', skipFonts: true });
    const height = (block.offsetHeight / block.offsetWidth) * width;
    if (height <= usable) {
      if (y + height > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.addImage(data, 'JPEG', margin, y, width, height);
      y += height + 6;
    } else {
      // Taller than a page: show it page by page, moving the picture up under the page's edge each time.
      let shown = 0;
      pdf.addPage();
      y = margin;
      while (shown < height) {
        pdf.addImage(data, 'JPEG', margin, margin - shown, width, height);
        shown += usable;
        if (shown < height) pdf.addPage();
      }
      y = margin + (height % usable || usable) + 6;
    }
  }
  pdf.save(filename);
}
