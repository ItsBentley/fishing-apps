// Render the full calculator content as a PNG and offer iOS sharing when available.
let capturedFile = null;

async function capturePage() {
  const button = $('capture-page');
  const status = $('capture-status');
  button.disabled = true;

  try {
    if (capturedFile) {
      const sharing = navigator.share({
        files: [capturedFile],
        title: 'Fish Weight Calculator'
      });
      await sharing;
      status.textContent = 'Choose Save Image in the share sheet to add it to Photos.';
      return;
    }

    status.textContent = 'Creating page image...';
    if (typeof window.html2canvas !== 'function') {
      throw new Error('The page image library is unavailable.');
    }

    await document.fonts.ready;
    const page = $('page-capture');
    const width = page.scrollWidth;
    const height = page.scrollHeight;
    const maxPixels = 16000000;
    // Keep long captures under common mobile canvas dimension and memory limits.
    const scale = Math.min(
      window.devicePixelRatio || 1,
      2,
      4096 / Math.max(width, height),
      Math.sqrt(maxPixels / (width * height))
    );
    const canvas = await window.html2canvas(page, {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      height,
      scale,
      useCORS: true,
      windowHeight: height,
      windowWidth: document.documentElement.clientWidth,
      width,
      logging: false
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the image.');

    const file = new File([blob], 'fish-weight-calculator.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      capturedFile = file;
      button.textContent = 'Share / Save image';
      try {
        await navigator.share({
          files: [file],
          title: 'Fish Weight Calculator'
        });
        status.textContent = 'Choose Save Image in the share sheet to add it to Photos.';
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          status.textContent = 'Image ready. Tap Share / Save image to try again.';
        } else {
          status.textContent = 'Image ready. Tap Share / Save image to open the share sheet.';
        }
      }
      return;
    }

    const url = URL.createObjectURL(file);
    const download = document.createElement('a');
    download.href = url;
    download.download = file.name;
    document.body.appendChild(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Image downloaded.';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      status.textContent = 'Image ready. Tap Share / Save image to try again.';
      return;
    }
    console.error('Unable to capture the calculator page:', error);
    status.textContent = capturedFile
      ? 'Could not open the share sheet. Tap Share / Save image to try again.'
      : 'Could not create the image. Please try again.';
  } finally {
    button.disabled = false;
  }
}
