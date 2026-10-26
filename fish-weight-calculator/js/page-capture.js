// Render the full calculator content as a PNG and download it.
async function capturePage() {
  const button = $('capture-page');
  const status = $('capture-status');
  button.disabled = true;
  status.textContent = 'Creating page image...';

  try {
    if (typeof window.html2canvas !== 'function') {
      throw new Error('The page image library is unavailable.');
    }

    await document.fonts.ready;
    const page = $('page-capture');
    const canvas = await window.html2canvas(page, {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      height: page.scrollHeight,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
      windowHeight: page.scrollHeight,
      windowWidth: document.documentElement.clientWidth,
      width: page.scrollWidth,
      logging: false
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the image.');

    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'fish-weight-calculator.png';
    document.body.appendChild(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Page image downloaded.';
  } catch (error) {
    console.error('Unable to capture the calculator page:', error);
    status.textContent = 'Could not create the image. Please try again.';
  } finally {
    button.disabled = false;
  }
}
