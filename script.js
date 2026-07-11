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
    const buttonQtyInput = document.getElementById('button-qty');
    const layoutStyleSelect = document.getElementById('layout-style');
    const gridRowsSelect = document.getElementById('grid-rows');
    const imagesListContainer = document.getElementById('images-list-container');
    const imagesList = document.getElementById('images-list');

    // ---- Multi-image state ----
    // Each entry: { id, name, img, zoom, cropX, cropY, qty, history, historyIndex }
    let images = [];
    let activeImageId = null;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    function getActiveImage() {
        return images.find(img => img.id === activeImageId) || null;
    }

    // ---- Undo / Redo ----
    function saveHistory() {
        const activeImg = getActiveImage();
        if (!activeImg) return;
        if (activeImg.historyIndex < activeImg.history.length - 1) {
            activeImg.history = activeImg.history.slice(0, activeImg.historyIndex + 1);
        }
        activeImg.history.push({ zoom: activeImg.zoom, cropX: activeImg.cropX, cropY: activeImg.cropY });
        activeImg.historyIndex++;
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        const a = getActiveImage();
        undoBtn.disabled = !a || a.historyIndex <= 0;
        redoBtn.disabled = !a || a.historyIndex >= a.history.length - 1;
    }

    undoBtn.addEventListener('click', () => {
        const a = getActiveImage();
        if (a && a.historyIndex > 0) { a.historyIndex--; applyHistoryState(); }
    });

    redoBtn.addEventListener('click', () => {
        const a = getActiveImage();
        if (a && a.historyIndex < a.history.length - 1) { a.historyIndex++; applyHistoryState(); }
    });

    function applyHistoryState() {
        const a = getActiveImage();
        if (!a) return;
        const s = a.history[a.historyIndex];
        a.zoom = s.zoom; a.cropX = s.cropX; a.cropY = s.cropY;
        zoomSlider.value = a.zoom; zoomNumber.value = a.zoom;
        xSlider.value = a.cropX; xNumber.value = a.cropX;
        ySlider.value = a.cropY; yNumber.value = a.cropY;
        updateUndoRedoButtons();
        updatePreview();
    }

    // ---- Canvas init ----
    fileInput.value = '';

    function initCanvas() {
        const W = 600, H = 600;
        previewCanvas.width = W; previewCanvas.height = H;
        previewCtx.fillStyle = '#424241';
        previewCtx.fillRect(0, 0, W, H);
        previewCtx.fillStyle = '#f0f0f0';
        previewCtx.font = '14px sans-serif';
        previewCtx.textAlign = 'center';
        previewCtx.fillText('Upload images to start cropping', W / 2, H / 2);
        previewCtx.textAlign = 'start';
    }
    initCanvas();

    // ---- Paper sizes ----
    const paperDimensions = {
        'A1': { w: 59.4, h: 84.1 }, 'A2': { w: 42.0, h: 59.4 },
        'A3': { w: 29.7, h: 42.0 }, 'A4': { w: 21.0, h: 29.7 },
        'Letter': { w: 21.59, h: 27.94 }, 'ASize': { w: 70.0, h: 70.0 }
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

    [paperWInput, paperHInput, targetSizeInput, dpiInput].forEach(i => i.addEventListener('input', updatePreview));
    if (layoutStyleSelect) layoutStyleSelect.addEventListener('change', updatePreview);
    if (gridRowsSelect) gridRowsSelect.addEventListener('change', updatePreview);

    // Active image quantity global input
    if (buttonQtyInput) {
        buttonQtyInput.addEventListener('input', (e) => {
            const a = getActiveImage();
            if (!a) return;
            a.qty = Math.max(1, parseInt(e.target.value) || 1);
            const listInput = document.querySelector(`.image-item[data-id="${a.id}"] .image-qty-input`);
            if (listInput) listInput.value = a.qty;
            updatePreview();
        });
    }

    // ---- Crop controls ----
    zoomSlider.addEventListener('input', (e) => {
        const a = getActiveImage(); if (!a) return;
        a.zoom = parseFloat(e.target.value); zoomNumber.value = a.zoom; updatePreview();
    });
    zoomSlider.addEventListener('change', saveHistory);

    zoomNumber.addEventListener('input', (e) => {
        const a = getActiveImage(); if (!a) return;
        a.zoom = parseFloat(e.target.value); zoomSlider.value = a.zoom; updatePreview();
    });
    zoomNumber.addEventListener('change', saveHistory);

    xSlider.addEventListener('input', (e) => {
        const a = getActiveImage(); if (!a) return;
        a.cropX = parseFloat(e.target.value); xNumber.value = a.cropX; updatePreview();
    });
    xSlider.addEventListener('change', saveHistory);

    xNumber.addEventListener('input', (e) => {
        const a = getActiveImage(); if (!a) return;
        a.cropX = parseFloat(e.target.value); xSlider.value = a.cropX; updatePreview();
    });
    xNumber.addEventListener('change', saveHistory);

    ySlider.addEventListener('input', (e) => {
        const a = getActiveImage(); if (!a) return;
        a.cropY = parseFloat(e.target.value); yNumber.value = a.cropY; updatePreview();
    });
    ySlider.addEventListener('change', saveHistory);

    yNumber.addEventListener('input', (e) => {
        const a = getActiveImage(); if (!a) return;
        a.cropY = parseFloat(e.target.value); ySlider.value = a.cropY; updatePreview();
    });
    yNumber.addEventListener('change', saveHistory);

    // ---- Canvas mouse: click-to-select + drag to pan ----
    previewCanvas.addEventListener('mousedown', (e) => {
        if (images.length === 0) return;

        const settings = getPrintSettings();
        const paperRatio = settings.paperWCm / settings.paperHCm;
        const maxPreviewSize = 600;
        const previewW = paperRatio >= 1 ? maxPreviewSize : maxPreviewSize * paperRatio;
        const paperScale = previewW / settings.paperWPx;
        const previewTargetPx = settings.targetPx * paperScale;
        const radius = previewTargetPx / 2;
        const previewGridW = settings.gridWidthPx * paperScale;
        const previewGridH = settings.gridHeightPx * paperScale;
        const previewH = paperRatio >= 1 ? maxPreviewSize / paperRatio : maxPreviewSize;
        const startOffX = (previewW - previewGridW) / 2;
        const startOffY = (previewH - previewGridH) / 2;

        const flat = buildFlatList();

        let clickedIdx = -1;
        for (let i = 0; i < settings.qty; i++) {
            const pos = settings.positions[i];
            const cx = startOffX + pos.x * paperScale + radius;
            const cy = startOffY + pos.y * paperScale + radius;
            const dx = e.offsetX - cx, dy = e.offsetY - cy;
            if (dx * dx + dy * dy <= radius * radius) { clickedIdx = i; break; }
        }

        if (clickedIdx !== -1 && flat[clickedIdx] && flat[clickedIdx].id !== activeImageId) {
            activeImageId = flat[clickedIdx].id;
            onActiveImageChanged();
        }

        const a = getActiveImage();
        if (!a) return;
        isDragging = true;
        dragStartX = e.offsetX - a.cropX;
        dragStartY = e.offsetY - a.cropY;
        previewCanvas.style.cursor = 'grabbing';
    });

    previewCanvas.addEventListener('mousemove', (e) => {
        const a = getActiveImage();
        if (!isDragging || !a) return;
        a.cropX = e.offsetX - dragStartX; a.cropY = e.offsetY - dragStartY;
        xSlider.value = a.cropX; xNumber.value = a.cropX;
        ySlider.value = a.cropY; yNumber.value = a.cropY;
        updatePreview();
    });

    previewCanvas.addEventListener('mouseup', () => {
        if (isDragging) { isDragging = false; previewCanvas.style.cursor = getActiveImage() ? 'grab' : 'default'; saveHistory(); }
    });

    previewCanvas.addEventListener('mouseleave', () => {
        if (isDragging) { isDragging = false; previewCanvas.style.cursor = getActiveImage() ? 'grab' : 'default'; saveHistory(); }
    });

    // ---- File upload (multiple) ----
    fileInput.addEventListener('change', (e) => {
        if (!e.target.files.length) return;
        const files = Array.from(e.target.files);
        fileInput.value = '';
        let loaded = 0;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const entry = {
                        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        name: file.name,
                        img,
                        zoom: 1, cropX: 0, cropY: 0, qty: 1,
                        history: [{ zoom: 1, cropX: 0, cropY: 0 }],
                        historyIndex: 0
                    };
                    images.push(entry);
                    if (!activeImageId) activeImageId = entry.id;
                    if (++loaded === files.length) onImagesUpdated();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    });

    // ---- Remove an image ----
    function removeImage(id) {
        const idx = images.findIndex(img => img.id === id);
        if (idx === -1) return;
        images.splice(idx, 1);
        if (activeImageId === id) {
            activeImageId = images.length ? images[Math.min(idx, images.length - 1)].id : null;
        }
        onImagesUpdated();
    }

    // ---- Build a flat array: one entry per slot (repeated by qty) ----
    function buildFlatList() {
        const flat = [];
        images.forEach(imgData => { for (let q = 0; q < imgData.qty; q++) flat.push(imgData); });
        return flat;
    }

    // ---- Sync controls to the active image ----
    function onActiveImageChanged() {
        const a = getActiveImage();
        if (!a) {
            cropControls.classList.add('hidden');
            exportBtn.disabled = true;
            previewCanvas.style.cursor = 'default';
            updateUndoRedoButtons();
            return;
        }
        cropControls.classList.remove('hidden');
        exportBtn.disabled = false;
        previewCanvas.style.cursor = 'grab';
        zoomSlider.value = a.zoom; zoomNumber.value = a.zoom;
        xSlider.value = a.cropX; xNumber.value = a.cropX;
        ySlider.value = a.cropY; yNumber.value = a.cropY;
        if (buttonQtyInput) buttonQtyInput.value = a.qty;
        document.querySelectorAll('.image-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === activeImageId);
        });
        updateUndoRedoButtons();
        updatePreview();
    }

    // ---- Rebuild the images sidebar list ----
    function onImagesUpdated() {
        if (images.length === 0) {
            imagesListContainer.classList.add('hidden');
            activeImageId = null;
            cropControls.classList.add('hidden');
            exportBtn.disabled = true;
            initCanvas();
            return;
        }
        imagesListContainer.classList.remove('hidden');
        exportBtn.disabled = false;
        imagesList.innerHTML = '';

        images.forEach(imgData => {
            const item = document.createElement('div');
            item.className = 'image-item' + (imgData.id === activeImageId ? ' active' : '');
            item.dataset.id = imgData.id;

            const thumb = document.createElement('img');
            thumb.className = 'image-thumb';
            thumb.src = imgData.img.src;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'image-name';
            nameSpan.innerText = imgData.name;

            const qtyControl = document.createElement('div');
            qtyControl.className = 'image-qty-control';
            qtyControl.addEventListener('click', e => e.stopPropagation());

            const decBtn = document.createElement('button');
            decBtn.className = 'image-qty-btn'; decBtn.innerText = '-';
            decBtn.addEventListener('click', () => {
                if (imgData.qty > 1) {
                    imgData.qty--;
                    qtyInput.value = imgData.qty;
                    if (imgData.id === activeImageId && buttonQtyInput) buttonQtyInput.value = imgData.qty;
                    updatePreview();
                }
            });

            const qtyInput = document.createElement('input');
            qtyInput.type = 'number'; qtyInput.className = 'image-qty-input';
            qtyInput.value = imgData.qty; qtyInput.min = '1';
            qtyInput.addEventListener('change', (e) => {
                imgData.qty = Math.max(1, parseInt(e.target.value) || 1);
                qtyInput.value = imgData.qty;
                if (imgData.id === activeImageId && buttonQtyInput) buttonQtyInput.value = imgData.qty;
                updatePreview();
            });

            const incBtn = document.createElement('button');
            incBtn.className = 'image-qty-btn'; incBtn.innerText = '+';
            incBtn.addEventListener('click', () => {
                imgData.qty++;
                qtyInput.value = imgData.qty;
                if (imgData.id === activeImageId && buttonQtyInput) buttonQtyInput.value = imgData.qty;
                updatePreview();
            });

            qtyControl.appendChild(decBtn);
            qtyControl.appendChild(qtyInput);
            qtyControl.appendChild(incBtn);

            const delBtn = document.createElement('button');
            delBtn.className = 'image-delete-btn'; delBtn.innerHTML = '&times;'; delBtn.title = 'Remove';
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeImage(imgData.id); });

            item.appendChild(thumb);
            item.appendChild(nameSpan);
            item.appendChild(qtyControl);
            item.appendChild(delBtn);

            item.addEventListener('click', () => {
                if (activeImageId !== imgData.id) { activeImageId = imgData.id; onActiveImageChanged(); }
            });

            imagesList.appendChild(item);
        });

        onActiveImageChanged();
    }

    // ---- Print settings (layout math) ----
    function getPrintSettings() {
        const dpi = parseFloat(dpiInput.value) || 300;
        const targetMm = parseFloat(targetSizeInput.value) || 58;
        let paperWCm = parseFloat(paperWInput.value) || 70;
        let paperHCm = parseFloat(paperHInput.value) || 70;
        if (paperSizeSelect.value !== 'custom') {
            const dims = paperDimensions[paperSizeSelect.value];
            paperWCm = dims.w; paperHCm = dims.h;
        }
        const targetCm = targetMm / 10;
        const targetPx = (targetCm / 2.54) * dpi;
        const paperWPx = (paperWCm / 2.54) * dpi;
        const paperHPx = (paperHCm / 2.54) * dpi;
        const qty = images.reduce((s, img) => s + img.qty, 0);
        const layoutStyle = layoutStyleSelect ? layoutStyleSelect.value : 'square';
        const limitRows = gridRowsSelect ? parseInt(gridRowsSelect.value) : 0;
        const gapPx = (2 / 10 / 2.54) * dpi;
        const marginPx = (5 / 10 / 2.54) * dpi;
        const S = targetPx + gapPx;
        const maxWidthAllowed = paperWPx - marginPx * 2;
        const maxHeightAllowed = paperHPx - marginPx * 2;
        let maxCols = Math.max(1, Math.floor((maxWidthAllowed + gapPx) / S));

        let positions = [], gridWidthPx = 0, gridHeightPx = 0;

        if (layoutStyle === 'staggered' && maxCols > 1) {
            const yStep = S * Math.sqrt(3) / 2;
            let filled = 0, row = 0;
            while (filled < qty) {
                if (limitRows > 0 && row >= limitRows) break;
                const isOdd = row % 2 !== 0;
                const colsInRow = Math.max(1, isOdd ? maxCols - 1 : maxCols);
                const startX = isOdd ? S / 2 : 0;
                const limit = Math.min(colsInRow, qty - filled);
                for (let c = 0; c < limit; c++) {
                    const ix = startX + c * S, iy = row * yStep;
                    if (ix + targetPx > maxWidthAllowed || iy + targetPx > maxHeightAllowed) continue;
                    positions.push({ x: ix, y: iy });
                    gridWidthPx = Math.max(gridWidthPx, ix + targetPx);
                    gridHeightPx = Math.max(gridHeightPx, iy + targetPx);
                }
                filled += limit; row++;
                if (row * yStep + targetPx > maxHeightAllowed) break;
            }
        } else {
            let filled = 0, row = 0;
            while (filled < qty) {
                if (limitRows > 0 && row >= limitRows) break;
                const limit = Math.min(maxCols, qty - filled);
                for (let c = 0; c < limit; c++) {
                    const ix = c * S, iy = row * S;
                    if (ix + targetPx > maxWidthAllowed || iy + targetPx > maxHeightAllowed) continue;
                    positions.push({ x: ix, y: iy });
                    gridWidthPx = Math.max(gridWidthPx, ix + targetPx);
                    gridHeightPx = Math.max(gridHeightPx, iy + targetPx);
                }
                filled += limit; row++;
                if (row * S + targetPx > maxHeightAllowed) break;
            }
        }

        const fitQty = positions.length;
        if (gridWidthPx > paperWPx - marginPx * 2 || gridHeightPx > paperHPx - marginPx * 2) {
            warningText.innerText = 'Quantity is too large for paper size!';
            warningText.classList.remove('hidden');
        } else if (targetCm > paperWCm || targetCm > paperHCm) {
            warningText.innerText = 'Target size is larger than paper size!';
            warningText.classList.remove('hidden');
        } else {
            warningText.classList.add('hidden');
        }

        return { dpi, targetPx, paperWPx, paperHPx, targetCm, targetMm, paperWCm, paperHCm, qty: fitQty, gapPx, maxCols, gridWidthPx, gridHeightPx, positions };
    }

    // ---- Draw one button image on a canvas context ----
    function drawButton(ctx, imgData, centerX, centerY, targetPx, paperScale, forExport) {
        const { img, zoom, cropX, cropY } = imgData;
        const size = Math.min(img.width, img.height);
        const scaleToTarget = targetPx / size;
        const sdx = img.width * scaleToTarget * zoom;
        const sdy = img.height * scaleToTarget * zoom;
        const panX = forExport ? cropX / paperScale : cropX;
        const panY = forExport ? cropY / paperScale : cropY;
        const offX = centerX - targetPx / 2 + (targetPx - sdx) / 2 + panX;
        const offY = centerY - targetPx / 2 + (targetPx - sdy) / 2 + panY;

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, targetPx / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, img.width, img.height, offX, offY, sdx, sdy);
        ctx.restore();
    }

    // ---- Generate full-res print canvas ----
    function generatePrintCanvas() {
        if (images.length === 0) return null;
        const s = getPrintSettings();
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = s.paperWPx; exportCanvas.height = s.paperHPx;
        const xCtx = exportCanvas.getContext('2d');
        xCtx.clearRect(0, 0, s.paperWPx, s.paperHPx);

        const paperRatio = s.paperWCm / s.paperHCm;
        const maxPreviewSize = 600;
        const previewW = paperRatio >= 1 ? maxPreviewSize : maxPreviewSize * paperRatio;
        const paperScale = previewW / s.paperWPx;

        const startOffX = (s.paperWPx - s.gridWidthPx) / 2;
        const startOffY = (s.paperHPx - s.gridHeightPx) / 2;
        const radius = s.targetPx / 2;
        const flat = buildFlatList();

        for (let i = 0; i < s.qty; i++) {
            const pos = s.positions[i];
            const imgData = flat[i];
            if (!imgData) continue;
            const cx = startOffX + pos.x + radius;
            const cy = startOffY + pos.y + radius;
            drawButton(xCtx, imgData, cx, cy, s.targetPx, paperScale, true);

            xCtx.strokeStyle = 'rgba(0,0,0,1)';
            xCtx.lineWidth = Math.max(1, s.targetPx * 0.005);
            xCtx.setLineDash([15, 15]);
            xCtx.beginPath(); xCtx.arc(cx, cy, radius, 0, Math.PI * 2); xCtx.stroke();
            xCtx.setLineDash([]);
        }
        return exportCanvas;
    }

    // ---- Preview canvas ----
    function updatePreview() {
        if (images.length === 0) { initCanvas(); return; }
        const settings = getPrintSettings();
        const paperRatio = settings.paperWCm / settings.paperHCm;
        const maxPreviewSize = 600;
        let previewW, previewH;
        if (paperRatio >= 1) { previewW = maxPreviewSize; previewH = maxPreviewSize / paperRatio; }
        else { previewH = maxPreviewSize; previewW = maxPreviewSize * paperRatio; }

        previewCanvas.width = previewW; previewCanvas.height = previewH;
        previewCtx.clearRect(0, 0, previewW, previewH);
        previewCtx.fillStyle = '#424241';
        previewCtx.fillRect(0, 0, previewW, previewH);

        const paperScale = previewW / settings.paperWPx;
        const previewTargetPx = settings.targetPx * paperScale;
        const radius = previewTargetPx / 2;
        const previewGridW = settings.gridWidthPx * paperScale;
        const previewGridH = settings.gridHeightPx * paperScale;
        const startOffX = (previewW - previewGridW) / 2;
        const startOffY = (previewH - previewGridH) / 2;
        const flat = buildFlatList();

        for (let i = 0; i < settings.qty; i++) {
            const pos = settings.positions[i];
            const imgData = flat[i];
            if (!imgData) continue;
            const cx = startOffX + pos.x * paperScale + radius;
            const cy = startOffY + pos.y * paperScale + radius;

            drawButton(previewCtx, imgData, cx, cy, previewTargetPx, paperScale, false);

            const isActive = imgData.id === activeImageId;
            previewCtx.strokeStyle = isActive ? '#a3be8c' : 'rgba(0,0,0,0.75)';
            previewCtx.lineWidth = isActive ? 2.5 : 1;
            previewCtx.setLineDash([isActive ? 6 : 5, isActive ? 6 : 5]);
            previewCtx.beginPath(); previewCtx.arc(cx, cy, radius, 0, Math.PI * 2); previewCtx.stroke();
            previewCtx.setLineDash([]);

            // Inner safe zone
            const innerMm = Math.max(1, settings.targetMm - 10);
            const innerRadius = (innerMm * (previewTargetPx / settings.targetMm)) / 2;
            previewCtx.strokeStyle = isActive ? 'rgba(163,190,140,0.7)' : 'rgba(0,0,0,0.4)';
            previewCtx.lineWidth = 1;
            previewCtx.setLineDash([4, 4]);
            previewCtx.beginPath(); previewCtx.arc(cx, cy, innerRadius, 0, Math.PI * 2); previewCtx.stroke();
            previewCtx.setLineDash([]);
        }

        previewCtx.fillStyle = '#f0f0f0';
        previewCtx.font = '12px sans-serif';
        previewCtx.fillText(`Paper: ${settings.paperWCm}x${settings.paperHCm}cm`, 10, 20);
        previewCtx.fillText(`Image: ${settings.targetMm}x${settings.targetMm}mm`, 10, 40);
    }

    // ---- Export ----
    let currentExportCanvas = null;

    exportBtn.addEventListener('click', () => {
        if (exportBtn.disabled) return;
        const origText = exportBtn.innerText;
        exportBtn.innerText = 'Generating...'; exportBtn.disabled = true;
        setTimeout(() => {
            currentExportCanvas = generatePrintCanvas();
            if (currentExportCanvas) {
                exportModal.classList.remove('hidden');
                modalCanvas.width = currentExportCanvas.width;
                modalCanvas.height = currentExportCanvas.height;
                modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
                modalCtx.drawImage(currentExportCanvas, 0, 0);
            }
            exportBtn.innerText = origText; exportBtn.disabled = false;
        }, 50);
    });

    modalCancelBtn.addEventListener('click', () => { exportModal.classList.add('hidden'); currentExportCanvas = null; });

    modalDownloadBtn.addEventListener('click', () => {
        if (!currentExportCanvas) return;
        const origText = modalDownloadBtn.innerText;
        modalDownloadBtn.innerText = 'Downloading...'; modalDownloadBtn.disabled = true;
        currentExportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `print_${targetSizeInput.value}mm.png`;
            link.href = url; link.click();
            URL.revokeObjectURL(url);
            modalDownloadBtn.innerText = origText; modalDownloadBtn.disabled = false;
            exportModal.classList.add('hidden'); currentExportCanvas = null;
        }, 'image/png');
    });
});
