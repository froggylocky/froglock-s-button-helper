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
    const previewCanvas = document.getElementById('preview-canvas');
    const previewCtx = previewCanvas.getContext('2d');
    const cropControls = document.getElementById('crop-controls');
    const zoomSlider = document.getElementById('zoom-slider');
    const xSlider = document.getElementById('x-slider');
    const ySlider = document.getElementById('y-slider');
    const zoomNumber = document.getElementById('zoom-number');
    const xNumber = document.getElementById('x-number');
    const yNumber = document.getElementById('y-number');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const exportModal = document.getElementById('export-modal');
    const modalCanvas = document.getElementById('modal-canvas');
    const modalCtx = modalCanvas.getContext('2d');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalDownloadBtn = document.getElementById('modal-download-btn');

    let currentImageData = null;
    let cropX = 0; // panning offset X
    let cropY = 0; // panning offset Y
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    let history = [];
    let historyIndex = -1;

    function saveHistory() {
        // Remove future history if we are overwriting
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push({
            zoom: zoomSlider.value,
            cropX: cropX,
            cropY: cropY
        });
        historyIndex++;
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    undoBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            applyHistoryState();
        }
    });

    redoBtn.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            applyHistoryState();
        }
    });

    function applyHistoryState() {
        const state = history[historyIndex];
        zoomSlider.value = state.zoom;
        zoomNumber.value = state.zoom;
        cropX = state.cropX;
        cropY = state.cropY;
        xSlider.value = cropX;
        xNumber.value = cropX;
        ySlider.value = cropY;
        yNumber.value = cropY;
        updatePreview();
    }

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

    const buttonQtyInput = document.getElementById('button-qty');

    [paperWInput, paperHInput, targetSizeInput, dpiInput, buttonQtyInput].forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    zoomSlider.addEventListener('change', saveHistory);
    zoomSlider.addEventListener('input', (e) => {
        zoomNumber.value = e.target.value;
        updatePreview();
    });

    zoomNumber.addEventListener('change', saveHistory);
    zoomNumber.addEventListener('input', (e) => {
        zoomSlider.value = e.target.value;
        updatePreview();
    });

    xSlider.addEventListener('input', (e) => {
        cropX = parseFloat(e.target.value);
        xNumber.value = cropX;
        updatePreview();
    });
    xSlider.addEventListener('change', saveHistory);

    xNumber.addEventListener('input', (e) => {
        cropX = parseFloat(e.target.value);
        xSlider.value = cropX;
        updatePreview();
    });
    xNumber.addEventListener('change', saveHistory);

    ySlider.addEventListener('input', (e) => {
        cropY = parseFloat(e.target.value);
        yNumber.value = cropY;
        updatePreview();
    });
    ySlider.addEventListener('change', saveHistory);

    yNumber.addEventListener('input', (e) => {
        cropY = parseFloat(e.target.value);
        ySlider.value = cropY;
        updatePreview();
    });
    yNumber.addEventListener('change', saveHistory);

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
        xSlider.value = cropX;
        xNumber.value = cropX;
        ySlider.value = cropY;
        yNumber.value = cropY;
        updatePreview();
    });

    previewCanvas.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            previewCanvas.style.cursor = 'grab';
            saveHistory();
        }
    });

    previewCanvas.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            previewCanvas.style.cursor = currentImageData ? 'grab' : 'default';
            saveHistory();
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            const file = e.target.files[0];
            fileInput.value = ''; // Immediately clear so it doesn't hold multiple files or same file twice

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    currentImageData = img;
                    cropX = 0; // Reset panning on new image
                    cropY = 0;
                    zoomSlider.value = 1; // Reset zoom on new image
                    zoomNumber.value = 1;
                    xSlider.value = 0;
                    xNumber.value = 0;
                    ySlider.value = 0;
                    yNumber.value = 0;

                    history = [];
                    historyIndex = -1;
                    saveHistory(); // Initial state

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

        const targetPx = (targetCm / 2.54) * dpi;
        const paperWPx = (paperWCm / 2.54) * dpi;
        const paperHPx = (paperHCm / 2.54) * dpi;

        const qty = parseInt(document.getElementById('button-qty').value) || 1;
        const gapPx = (2 / 10 / 2.54) * dpi; // 2mm gap
        const marginPx = (5 / 10 / 2.54) * dpi; // 5mm page margin

        let maxCols = Math.floor((paperWPx - marginPx * 2 + gapPx) / (targetPx + gapPx));
        if (maxCols < 1) maxCols = 1;
        const cols = Math.min(qty, maxCols);
        const rows = Math.ceil(qty / cols);
        const gridWidthPx = cols * targetPx + Math.max(0, cols - 1) * gapPx;
        const gridHeightPx = rows * targetPx + Math.max(0, rows - 1) * gapPx;

        // Check bounds (include margins)
        if (gridWidthPx > paperWPx - marginPx * 2 || gridHeightPx > paperHPx - marginPx * 2) {
            warningText.innerText = "Quantity is too large for paper size!";
            warningText.classList.remove('hidden');
        } else if (targetCm > paperWCm || targetCm > paperHCm) {
            warningText.innerText = "Target size is larger than paper size!";
            warningText.classList.remove('hidden');
        } else {
            warningText.classList.add('hidden');
        }

        return {
            dpi, targetPx, paperWPx, paperHPx, targetCm, targetMm, paperWCm, paperHCm, qty, gapPx, cols, rows, gridWidthPx, gridHeightPx
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

        // Grid start coordinates from top-left corner with 5mm print margin
        const marginPx = (5 / 10 / 2.54) * s.dpi;
        const startOffX = marginPx;
        const startOffY = marginPx;

        const radius = targetPx / 2;

        for (let i = 0; i < s.qty; i++) {
            const c = i % s.cols;
            const r = Math.floor(i / s.cols);

            const itemX = startOffX + c * (targetPx + s.gapPx);
            const itemY = startOffY + r * (targetPx + s.gapPx);

            const centerX = itemX + radius;
            const centerY = itemY + radius;

            // Draw centered and masked by target shape
            xCtx.save();
            xCtx.beginPath();
            xCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            xCtx.clip();

            const imgOffsetX = itemX + (targetPx - scaledDrawSizeX) / 2 + printCropX;
            const imgOffsetY = itemY + (targetPx - scaledDrawSizeY) / 2 + printCropY;

            xCtx.drawImage(
                img,
                0, 0, img.width, img.height, // source
                imgOffsetX, imgOffsetY, scaledDrawSizeX, scaledDrawSizeY // destination
            );

            xCtx.restore();

            // Draw a dashed black outline around the target area for fully transparent images
            xCtx.strokeStyle = "rgba(0, 0, 0, 1)";
            xCtx.lineWidth = Math.max(1, targetPx * 0.005);
            xCtx.setLineDash([15, 15]);

            xCtx.beginPath();
            xCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            xCtx.stroke();
            xCtx.setLineDash([]); // Reset line dash
        }

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

        const radius = previewTargetPx / 2;
        const centerX = dxCenter + radius;
        const centerY = dyCenter + radius;

        previewCtx.save();

        // Clip to the preview target box
        previewCtx.beginPath();
        previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
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
        previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        previewCtx.stroke();

        previewCtx.setLineDash([]);

        // Draw 10mm inner safe zone dashed line (only in preview)
        // 10mm total reduction means target size - 10mm.
        const innerMm = Math.max(1, settings.targetMm - 10);
        const innerPx = innerMm * (previewTargetPx / settings.targetMm);
        const innerRadius = innerPx / 2;

        previewCtx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        previewCtx.lineWidth = 1;
        previewCtx.setLineDash([4, 4]);
        previewCtx.beginPath();
        previewCtx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        previewCtx.stroke();
        previewCtx.setLineDash([]);

        previewCtx.fillStyle = "#f0f0f0";
        previewCtx.font = "12px sans-serif";
        previewCtx.fillText(`Paper: ${settings.paperWCm}x${settings.paperHCm}cm`, 10, 20);
        previewCtx.fillText(`Image: ${settings.targetMm}x${settings.targetMm}mm`, dxCenter, dyCenter - 6);
    }

    let currentExportCanvas = null;

    exportBtn.addEventListener('click', () => {
        if (exportBtn.disabled) return;

        const originalText = exportBtn.innerText;
        exportBtn.innerText = 'Generating...';
        exportBtn.disabled = true;

        setTimeout(() => {
            currentExportCanvas = generatePrintCanvas();
            if (currentExportCanvas) {
                // Show modal and draw preview
                exportModal.classList.remove('hidden');
                modalCanvas.width = currentExportCanvas.width;
                modalCanvas.height = currentExportCanvas.height;
                modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
                modalCtx.drawImage(currentExportCanvas, 0, 0);

                exportBtn.innerText = originalText;
                exportBtn.disabled = false;
            } else {
                exportBtn.innerText = originalText;
                exportBtn.disabled = false;
            }
        }, 50);
    });

    modalCancelBtn.addEventListener('click', () => {
        exportModal.classList.add('hidden');
        currentExportCanvas = null;
    });

    modalDownloadBtn.addEventListener('click', () => {
        if (!currentExportCanvas) return;

        const originalText = modalDownloadBtn.innerText;
        modalDownloadBtn.innerText = 'Downloading...';
        modalDownloadBtn.disabled = true;

        currentExportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `print_${targetSizeInput.value}mm.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);

            modalDownloadBtn.innerText = originalText;
            modalDownloadBtn.disabled = false;
            exportModal.classList.add('hidden');
            currentExportCanvas = null;
        }, 'image/png');
    });
});
