document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const paperSizeSelect = document.getElementById('paper-size');
    const customDimensions = document.querySelector('.custom-dimensions');
    const paperWInput = document.getElementById('paper-w');
    const paperHInput = document.getElementById('paper-h');
    const targetSizeInput = document.getElementById('target-size');
    const dpiInput = document.getElementById('dpi');
    const exportBtn = document.getElementById('export-btn');
    const warningText = document.getElementById('export-warning');
    const previewCtx = previewCanvas.getContext('2d');
    const cropControls = document.getElementById('crop-controls');
    const zoomSlider = document.getElementById('zoom-slider');
    const shapeSelect = document.getElementById('shape-select');

    let currentImageData = null;
    let cropX = 0; // panning offset X
    let cropY = 0; // panning offset Y
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    // Reset file input in case browser cached it
    fileInput.value = '';

    // Draw initial blank state
    function initCanvas() {
        const previewW = 600;
        const previewH = 600;
        previewCanvas.width = previewW;
        previewCanvas.height = previewH;
        previewCtx.fillStyle = "#424241";
        previewCtx.fillRect(0, 0, previewW, previewH);

        previewCtx.fillStyle = "#f0f0f0";
        previewCtx.font = "14px sans-serif";
        previewCtx.textAlign = "center";
        previewCtx.fillText("Upload an image to start cropping", previewW / 2, previewH / 2);
        previewCtx.textAlign = "start"; // Reset
    }
    initCanvas();

    // Paper sizes in cm
    const paperDimensions = {
        'A1': { w: 59.4, h: 84.1 },
        'A2': { w: 42.0, h: 59.4 },
        'A3': { w: 29.7, h: 42.0 },
        'A4': { w: 21.0, h: 29.7 },
        'Letter': { w: 21.59, h: 27.94 },
        'ASize': { w: 70.0, h: 70.0 }
    };

    paperSizeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customDimensions.classList.remove('hidden');
        } else {
            customDimensions.classList.add('hidden');
            paperWInput.value = paperDimensions[e.target.value].w;
            paperHInput.value = paperDimensions[e.target.value].h;
        }
        updatePreview();
    });

    [paperWInput, paperHInput, targetSizeInput, dpiInput].forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    shapeSelect.addEventListener('change', updatePreview);
    zoomSlider.addEventListener('input', updatePreview);

    // Panning logic
    previewCanvas.addEventListener('mousedown', (e) => {
        if (!currentImageData) return;
        isDragging = true;
        dragStartX = e.offsetX - cropX;
        dragStartY = e.offsetY - cropY;
        previewCanvas.style.cursor = 'grabbing';
    });

    previewCanvas.addEventListener('mousemove', (e) => {
        if (!isDragging || !currentImageData) return;
        cropX = e.offsetX - dragStartX;
        cropY = e.offsetY - dragStartY;
        updatePreview();
    });

    previewCanvas.addEventListener('mouseup', () => {
        isDragging = false;
        previewCanvas.style.cursor = 'grab';
    });

    previewCanvas.addEventListener('mouseleave', () => {
        isDragging = false;
        previewCanvas.style.cursor = currentImageData ? 'grab' : 'default';
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    currentImageData = img;
                    cropX = 0; // Reset panning on new image
                    cropY = 0;
                    zoomSlider.value = 1; // Reset zoom on new image
                    exportBtn.disabled = false;
                    cropControls.classList.remove('hidden');
                    previewCanvas.style.cursor = 'grab';
                    updatePreview();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    function getPrintSettings() {
        const dpi = parseFloat(dpiInput.value) || 300;
        const targetMm = parseFloat(targetSizeInput.value) || 58;

        // paper uses cm
        let paperWCm = parseFloat(paperWInput.value) || 70;
        let paperHCm = parseFloat(paperHInput.value) || 70;

        if (paperSizeSelect.value !== 'custom') {
            const dims = paperDimensions[paperSizeSelect.value];
            paperWCm = dims.w;
            paperHCm = dims.h;
        }

        // convert mm target to cm for comparison with paper size
        const targetCm = targetMm / 10;

        // Check bounds
        if (targetCm > paperWCm || targetCm > paperHCm) {
            warningText.classList.remove('hidden');
        } else {
            warningText.classList.add('hidden');
        }

        const targetPx = (targetCm / 2.54) * dpi;
        const paperWPx = (paperWCm / 2.54) * dpi;
        const paperHPx = (paperHCm / 2.54) * dpi;

        return {
            dpi, targetPx, paperWPx, paperHPx, targetCm, targetMm, paperWCm, paperHCm
        };
    }

    function generatePrintCanvas() {
        if (!currentImageData) return null;

        const s = getPrintSettings();

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = s.paperWPx;
        exportCanvas.height = s.paperHPx;
        const xCtx = exportCanvas.getContext('2d');

        xCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

        const img = currentImageData;
        const zoom = parseFloat(zoomSlider.value);

        // Target physical size in pixels
        const targetPx = s.targetPx;

        // Calculate the crop taking zoom and panning into account
        const size = Math.min(img.width, img.height); // Base crop size before zoom
        const drawSizeX = img.width * zoom;
        const drawSizeY = img.height * zoom;

        // Determine the base scale for drawing the image to exactly fill the target box at 1x zoom
        const scaleToTargetX = targetPx / size;
        const scaleToTargetY = targetPx / size;

        // Apply scaling
        const scaledDrawSizeX = img.width * scaleToTargetX * zoom;
        const scaledDrawSizeY = img.height * scaleToTargetY * zoom;

        // Pan offset (scaled to target print resolution based on preview ratio)
        // Since cropX/Y are in screen preview pixels, we must calculate the ratio
        const paperRatio = s.paperWCm / s.paperHCm;
        const maxPreviewSize = 600;
        let previewW = paperRatio >= 1 ? maxPreviewSize : maxPreviewSize * paperRatio;
        const paperScale = previewW / s.paperWPx;

        const printCropX = cropX / paperScale;
        const printCropY = cropY / paperScale;

        // Standard center calculation
        const dxCenter = (s.paperWPx - s.targetPx) / 2;
        const dyCenter = (s.paperHPx - s.targetPx) / 2;

        const shape = shapeSelect.value;
        const radius = targetPx / 2;
        const centerX = dxCenter + radius;
        const centerY = dyCenter + radius;

        // Draw centered and masked by target shape
        xCtx.save();

        // Create clipping mask exactly at the target shape
        xCtx.beginPath();
        if (shape === 'circle') {
            xCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        } else {
            xCtx.rect(dxCenter, dyCenter, targetPx, targetPx);
        }
        xCtx.clip();

        // Where to start drawing the top left corner of the image
        const imgOffsetX = dxCenter + (targetPx - scaledDrawSizeX) / 2 + printCropX;
        const imgOffsetY = dyCenter + (targetPx - scaledDrawSizeY) / 2 + printCropY;

        xCtx.drawImage(
            img,
            0, 0, img.width, img.height, // source (entire image)
            imgOffsetX, imgOffsetY, scaledDrawSizeX, scaledDrawSizeY // destination
        );

        xCtx.restore();

        // Draw a dashed black outline around the target area for fully transparent images
        xCtx.strokeStyle = "rgba(0, 0, 0, 1)";
        xCtx.lineWidth = Math.max(1, targetPx * 0.005); // dynamic line width
        xCtx.setLineDash([15, 15]);

        xCtx.beginPath();
        if (shape === 'circle') {
            xCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        } else {
            xCtx.rect(dxCenter, dyCenter, targetPx, targetPx);
        }
        xCtx.stroke();

        xCtx.setLineDash([]); // Reset line dash

        return exportCanvas;
    }

    function updatePreview() {
        if (!currentImageData) return;

        const settings = getPrintSettings();
        const paperRatio = settings.paperWCm / settings.paperHCm;

        const maxPreviewSize = 600;
        let previewW, previewH;

        if (paperRatio >= 1) {
            previewW = maxPreviewSize;
            previewH = maxPreviewSize / paperRatio;
        } else {
            previewH = maxPreviewSize;
            previewW = maxPreviewSize * paperRatio;
        }

        previewCanvas.width = previewW;
        previewCanvas.height = previewH;

        previewCtx.clearRect(0, 0, previewW, previewH);

        previewCtx.fillStyle = "#424241";
        previewCtx.fillRect(0, 0, previewW, previewH);

        const paperScale = previewW / settings.paperWPx;
        const previewTargetPx = settings.targetPx * paperScale;

        const img = currentImageData;
        const zoom = parseFloat(zoomSlider.value);

        const size = Math.min(img.width, img.height);

        const scaleToTarget = previewTargetPx / size;
        const scaledDrawSizeX = img.width * scaleToTarget * zoom;
        const scaledDrawSizeY = img.height * scaleToTarget * zoom;

        const dxCenter = (previewW - previewTargetPx) / 2;
        const dyCenter = (previewH - previewTargetPx) / 2;

        const shape = shapeSelect.value;
        const radius = previewTargetPx / 2;
        const centerX = dxCenter + radius;
        const centerY = dyCenter + radius;

        previewCtx.save();

        // Clip to the preview target box
        previewCtx.beginPath();
        if (shape === 'circle') {
            previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        } else {
            previewCtx.rect(dxCenter, dyCenter, previewTargetPx, previewTargetPx);
        }
        previewCtx.clip();

        // Include mouse-drag offset
        const imgOffsetX = dxCenter + (previewTargetPx - scaledDrawSizeX) / 2 + cropX;
        const imgOffsetY = dyCenter + (previewTargetPx - scaledDrawSizeY) / 2 + cropY;

        previewCtx.drawImage(
            img,
            0, 0, img.width, img.height,
            imgOffsetX, imgOffsetY, scaledDrawSizeX, scaledDrawSizeY
        );

        previewCtx.restore();

        previewCtx.strokeStyle = "rgba(0, 0, 0, 1)";
        previewCtx.lineWidth = 1;
        previewCtx.setLineDash([5, 5]);

        previewCtx.beginPath();
        if (shape === 'circle') {
            previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        } else {
            previewCtx.rect(dxCenter, dyCenter, previewTargetPx, previewTargetPx);
        }
        previewCtx.stroke();

        previewCtx.setLineDash([]);

        previewCtx.fillStyle = "#f0f0f0";
        previewCtx.font = "12px sans-serif";
        previewCtx.fillText(`Paper: ${settings.paperWCm}x${settings.paperHCm}cm`, 10, 20);
        previewCtx.fillText(`Image: ${settings.targetMm}x${settings.targetMm}mm`, dx, dy - 6);
    }

    exportBtn.addEventListener('click', () => {
        if (exportBtn.disabled) return;

        const originalText = exportBtn.innerText;
        exportBtn.innerText = 'Generating...';
        exportBtn.disabled = true;

        setTimeout(() => {
            const canvas = generatePrintCanvas();
            if (canvas) {
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `print_${targetSizeInput.value}mm.png`;
                    link.href = url;
                    link.click();
                    URL.revokeObjectURL(url);

                    exportBtn.innerText = originalText;
                    exportBtn.disabled = false;
                }, 'image/png');
            } else {
                exportBtn.innerText = originalText;
                exportBtn.disabled = false;
            }
        }, 50);
    });
});
