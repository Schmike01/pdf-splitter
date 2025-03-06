// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// App state
const appState = {
    currentPdf: null,
    currentFile: null,
    pageCount: 0,
    selectedPages: new Set(),
    thumbnailSize: 2, // Default medium size
    pdfDocument: null,
    batchFiles: [], // For batch processing
};

// DOM Elements
const elements = {
    // Tabs
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Upload section
    dropArea: document.getElementById('drop-area'),
    fileInput: document.getElementById('file-input'),
    uploadProgress: document.getElementById('upload-progress'),
    progressFill: document.querySelector('.progress-fill'),
    uploadMessage: document.getElementById('upload-message'),
    
    // Preview section
    filenameDisplay: document.getElementById('filename-display'),
    pageCount: document.getElementById('page-count'),
    selectAll: document.getElementById('select-all'),
    deselectAll: document.getElementById('deselect-all'),
    pageRange: document.getElementById('page-range'),
    applyRange: document.getElementById('apply-range'),
    thumbnailSize: document.getElementById('thumbnail-size'),
    thumbnailsContainer: document.getElementById('thumbnails-container'),
    
    // Split section
    outputFormat: document.getElementsByName('output-format'),
    outputFilename: document.getElementById('output-filename'),
    splitButton: document.getElementById('split-button'),
    extractTextButton: document.getElementById('extract-text-button'),
    processingStatus: document.getElementById('processing-status'),
    downloadContainer: document.getElementById('download-container'),
    
    // Batch section
    batchDropArea: document.getElementById('batch-drop-area'),
    batchFileInput: document.getElementById('batch-file-input'),
    batchFilesList: document.getElementById('batch-files-list'),
    batchSplit: document.getElementById('batch-split'),
    batchExtractText: document.getElementById('batch-extract-text'),
    batchStatus: document.getElementById('batch-status'),
    batchResults: document.getElementById('batch-results'),
    
    // Accessibility
    highContrastToggle: document.getElementById('high-contrast-toggle'),
    largeTextToggle: document.getElementById('large-text-toggle')
};

// Initialize the application
function initApp() {
    // Set up event listeners
    setupTabNavigation();
    setupFileUpload();
    setupPageSelection();
    setupOutputOptions();
    setupBatchProcessing();
    setupAccessibilityControls();
    
    // Check for stored preferences
    loadAccessibilityPreferences();
}

// Tab Navigation
function setupTabNavigation() {
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs
            elements.tabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));
            
            // Activate selected tab
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// File Upload Section
function setupFileUpload() {
    // File input change
    elements.fileInput.addEventListener('change', handleFileSelection);
    
    // Drag and drop functionality
    elements.dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropArea.classList.add('highlight');
    });
    
    elements.dropArea.addEventListener('dragleave', () => {
        elements.dropArea.classList.remove('highlight');
    });
    
    elements.dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropArea.classList.remove('highlight');
        
        if (e.dataTransfer.files.length) {
            handleFileSelection({ target: { files: e.dataTransfer.files } });
        }
    });
}

// Handle file selection (either through input or drop)
function handleFileSelection(event) {
    const file = event.target.files[0];
    
    if (file && file.type === 'application/pdf') {
        appState.currentFile = file;
        loadPdf(file);
    } else {
        showMessage('Please select a valid PDF file.', 'error');
    }
}

// Load PDF file
async function loadPdf(file) {
    try {
        // Update UI
        elements.filenameDisplay.textContent = file.name;
        showProgress(0);
        showMessage('Loading PDF...', 'info');
        
        // Read the file
        const arrayBuffer = await readFileAsArrayBuffer(file);
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        
        loadingTask.onProgress = (progressData) => {
            if (progressData.total > 0) {
                const percent = (progressData.loaded / progressData.total) * 100;
                showProgress(percent);
            }
        };
        
        appState.pdfDocument = await loadingTask.promise;
        appState.pageCount = appState.pdfDocument.numPages;
        
        // Update UI
        elements.pageCount.textContent = appState.pageCount;
        showMessage(`PDF loaded successfully. ${appState.pageCount} pages found.`, 'success');
        showProgress(100);
        
        // Reset selected pages
        appState.selectedPages = new Set();
        
        // Generate thumbnails
        generateThumbnails();
        
        // Switch to preview tab
        setTimeout(() => {
            document.querySelector('[data-tab="preview"]').click();
        }, 500);
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        showMessage('Error loading PDF: ' + error.message, 'error');
    }
}

// Read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Show upload progress
function showProgress(percent) {
    elements.progressFill.style.width = `${percent}%`;
}

// Show message in upload area
function showMessage(message, type = 'info') {
    elements.uploadMessage.textContent = message;
    elements.uploadMessage.className = `message ${type}`;
}

// Page Selection Section
function setupPageSelection() {
    // Select/Deselect All buttons
    elements.selectAll.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.page-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            const pageNum = parseInt(checkbox.getAttribute('data-page'));
            appState.selectedPages.add(pageNum);
        });
    });
    
    elements.deselectAll.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.page-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const pageNum = parseInt(checkbox.getAttribute('data-page'));
            appState.selectedPages.delete(pageNum);
        });
    });
    
    // Apply Range button
    elements.applyRange.addEventListener('click', applyPageRange);
    
    // Thumbnail size slider
    elements.thumbnailSize.addEventListener('input', (e) => {
        appState.thumbnailSize = parseInt(e.target.value);
        updateThumbnailSize();
    });
}

// Generate thumbnails for all pages
async function generateThumbnails() {
    // Clear previous thumbnails
    elements.thumbnailsContainer.innerHTML = '';
    
    // Generate thumbnails for each page
    for (let i = 1; i <= appState.pageCount; i++) {
        const thumbnailItem = document.createElement('div');
        thumbnailItem.className = 'thumbnail-item';
        thumbnailItem.innerHTML = `
            <div class="thumbnail-placeholder" style="height: 200px; display: flex; align-items: center; justify-content: center;">
                <span>Loading page ${i}...</span>
            </div>
            <div class="thumbnail-footer">
                <span class="page-number">Page ${i}</span>
                <input type="checkbox" class="page-checkbox" data-page="${i}" aria-label="Select page ${i}">
            </div>
        `;
        
        elements.thumbnailsContainer.appendChild(thumbnailItem);
        
        // Add event listener to checkbox
        const checkbox = thumbnailItem.querySelector('.page-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                appState.selectedPages.add(i);
            } else {
                appState.selectedPages.delete(i);
            }
        });
        
        // Render thumbnail (async)
        renderThumbnail(i, thumbnailItem);
    }
    
    // Update thumbnail size based on slider
    updateThumbnailSize();
}

// Render single thumbnail
async function renderThumbnail(pageNum, container) {
    try {
        const page = await appState.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Replace the placeholder with the actual thumbnail
        const thumbnailPlaceholder = container.querySelector('.thumbnail-placeholder');
        const thumbnailImage = document.createElement('img');
        thumbnailImage.className = 'thumbnail-image';
        thumbnailImage.src = canvas.toDataURL();
        thumbnailImage.alt = `Page ${pageNum} thumbnail`;
        
        container.replaceChild(thumbnailImage, thumbnailPlaceholder);
        
        // Make the thumbnail clickable to show larger preview
        thumbnailImage.addEventListener('click', () => {
            showPagePreview(pageNum);
        });
        
    } catch (error) {
        console.error(`Error rendering thumbnail for page ${pageNum}:`, error);
        const thumbnailPlaceholder = container.querySelector('.thumbnail-placeholder');
        thumbnailPlaceholder.innerHTML = `<span>Error loading page ${pageNum}</span>`;
    }
}

// Update thumbnail size based on slider
function updateThumbnailSize() {
    const container = elements.thumbnailsContainer;
    
    // Remove previous size classes
    container.classList.remove('size-small', 'size-medium', 'size-large');
    
    // Apply new size class
    switch (appState.thumbnailSize) {
        case 1: // Small
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
            break;
        case 2: // Medium (default)
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            break;
        case 3: // Large
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
            break;
    }
}

// Apply page range from input
function applyPageRange() {
    const rangeInput = elements.pageRange.value.trim();
    
    if (!rangeInput) {
        return;
    }
    
    // Reset selection first
    const checkboxes = document.querySelectorAll('.page-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        const pageNum = parseInt(checkbox.getAttribute('data-page'));
        appState.selectedPages.delete(pageNum);
    });
    
    // Parse range input and apply selection
    const ranges = rangeInput.split(',');
    
    ranges.forEach(range => {
        range = range.trim();
        
        if (range.includes('-')) {
            // Range like "1-5"
            const [start, end] = range.split('-').map(Number);
            
            if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= appState.pageCount) {
                for (let i = start; i <= end; i++) {
                    selectPage(i);
                }
            }
        } else {
            // Single page like "3"
            const pageNum = parseInt(range);
            
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= appState.pageCount) {
                selectPage(pageNum);
            }
        }
    });
}

// Select a single page
function selectPage(pageNum) {
    appState.selectedPages.add(pageNum);
    
    // Update checkbox
    const checkbox = document.querySelector(`.page-checkbox[data-page="${pageNum}"]`);
    if (checkbox) {
        checkbox.checked = true;
    }
}

// Show page preview in modal
function showPagePreview(pageNum) {
    // Create modal elements
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.maxHeight = '90%';
    modalContent.style.overflow = 'auto';
    modalContent.style.position = 'relative';
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.fontSize = '24px';
    closeButton.style.border = 'none';
    closeButton.style.background = 'none';
    closeButton.style.cursor = 'pointer';
    
    const previewContainer = document.createElement('div');
    previewContainer.style.textAlign = 'center';
    
    const pageInfo = document.createElement('h3');
    pageInfo.textContent = `Page ${pageNum} of ${appState.pageCount}`;
    pageInfo.style.marginBottom = '10px';
    
    const previewPlaceholder = document.createElement('div');
    previewPlaceholder.textContent = 'Loading preview...';
    previewPlaceholder.style.padding = '100px 20px';
    
    // Add navigation buttons
    const navContainer = document.createElement('div');
    navContainer.style.display = 'flex';
    navContainer.style.justifyContent = 'space-between';
    navContainer.style.marginTop = '20px';
    
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous Page';
    prevButton.disabled = pageNum <= 1;
    
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next Page';
    nextButton.disabled = pageNum >= appState.pageCount;
    
    navContainer.appendChild(prevButton);
    navContainer.appendChild(nextButton);
    
    // Assemble modal
    previewContainer.appendChild(pageInfo);
    previewContainer.appendChild(previewPlaceholder);
    previewContainer.appendChild(navContainer);
    
    modalContent.appendChild(closeButton);
    modalContent.appendChild(previewContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Event listeners
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    prevButton.addEventListener('click', () => {
        if (pageNum > 1) {
            document.body.removeChild(modal);
            showPagePreview(pageNum - 1);
        }
    });
    
    nextButton.addEventListener('click', () => {
        if (pageNum < appState.pageCount) {
            document.body.removeChild(modal);
            showPagePreview(pageNum + 1);
        }
    });
    
    // Render high-quality preview
    renderPagePreview(pageNum, previewContainer, previewPlaceholder);
}

// Render high-quality page preview
async function renderPagePreview(pageNum, container, placeholder) {
    try {
        const page = await appState.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Replace placeholder with rendered preview
        const previewImage = document.createElement('img');
        previewImage.src = canvas.toDataURL();
        previewImage.alt = `Page ${pageNum} preview`;
        previewImage.style.maxWidth = '100%';
        previewImage.style.height = 'auto';
        
        container.replaceChild(previewImage, placeholder);
        
    } catch (error) {
        console.error(`Error rendering preview for page ${pageNum}:`, error);
        placeholder.textContent = `Error loading preview for page ${pageNum}`;
    }
}

// Output Options Section
function setupOutputOptions() {
    elements.splitButton.addEventListener('click', splitPdf);
    elements.extractTextButton.addEventListener('click', extractText);
}

// Split PDF function
async function splitPdf() {
    if (!appState.pdfDocument) {
        showProcessingMessage('No PDF loaded.', 'error');
        return;
    }
    
    if (appState.selectedPages.size === 0) {
        showProcessingMessage('Please select at least one page to split.', 'error');
        return;
    }
    
    try {
        showProcessingMessage('Splitting PDF...', 'info');
        
        // Load PDF data using pdf-lib
        const arrayBuffer = await readFileAsArrayBuffer(appState.currentFile);
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        
        // Create a new document
        const newPdfDoc = await PDFLib.PDFDocument.create();
        
        // Sort selected pages for consistency
        const selectedPages = Array.from(appState.selectedPages).sort((a, b) => a - b);
        
        // Copy selected pages to new document
        for (const pageNum of selectedPages) {
            // Page numbers in pdf-lib are 0-based
            const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
            newPdfDoc.addPage(copiedPage);
        }
        
        // Save new document as bytes
        const pdfBytes = await newPdfDoc.save();
        
        // Create download link
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        // Get filename
        let outputFilename = elements.outputFilename.value.trim();
        if (!outputFilename) {
            const originalName = appState.currentFile.name.replace('.pdf', '');
            const pageRange = selectedPages.length > 1 
                ? `${selectedPages[0]}-${selectedPages[selectedPages.length - 1]}` 
                : selectedPages[0];
            outputFilename = `${originalName}_pages_${pageRange}.pdf`;
        } else if (!outputFilename.toLowerCase().endsWith('.pdf')) {
            outputFilename += '.pdf';
        }
        
        // Create download link
        createDownloadLink(blob, outputFilename, 'PDF');
        
        showProcessingMessage('PDF split successfully!', 'success');
        
    } catch (error) {
        console.error('Error splitting PDF:', error);
        showProcessingMessage('Error splitting PDF: ' + error.message, 'error');
    }
}

// Extract text from PDF function
async function extractText() {
    if (!appState.pdfDocument) {
        showProcessingMessage('No PDF loaded.', 'error');
        return;
    }
    
    if (appState.selectedPages.size === 0) {
        showProcessingMessage('Please select at least one page to extract text from.', 'error');
        return;
    }
    
    try {
        showProcessingMessage('Extracting text...', 'info');
        
        // Sort selected pages for consistency
        const selectedPages = Array.from(appState.selectedPages).sort((a, b) => a - b);
        
        let extractedText = '';
        
        // Extract text from each selected page
        for (const pageNum of selectedPages) {
            const page = await appState.pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            extractedText += `--- Page ${pageNum} ---\n\n`;
            
            // Process text items
            const items = textContent.items;
            let lastY;
            
            for (const item of items) {
                if (lastY !== item.transform[5] && lastY !== undefined) {
                    extractedText += '\n';  // Add newline for new vertical position
                }
                
                extractedText += item.str + ' ';
                lastY = item.transform[5];
            }
            
            extractedText += '\n\n';
        }
        
        // Create download link
        const blob = new Blob([extractedText], { type: 'text/plain' });
        
        // Get filename
        let outputFilename = elements.outputFilename.value.trim();
        if (!outputFilename) {
            const originalName = appState.currentFile.name.replace('.pdf', '');
            const pageRange = selectedPages.length > 1 
                ? `${selectedPages[0]}-${selectedPages[selectedPages.length - 1]}` 
                : selectedPages[0];
            outputFilename = `${originalName}_pages_${pageRange}.txt`;
        } else if (!outputFilename.toLowerCase().endsWith('.txt')) {
            outputFilename += '.txt';
        }
        
        // Create download link
        createDownloadLink(blob, outputFilename, 'Text');
        
        showProcessingMessage('Text extracted successfully!', 'success');
        
    } catch (error) {
        console.error('Error extracting text:', error);
        showProcessingMessage('Error extracting text: ' + error.message, 'error');
    }
}

// Show processing message
function showProcessingMessage(message, type = 'info') {
    elements.processingStatus.textContent = message;
    elements.processingStatus.className = `processing-status ${type}`;
}

// Create download link
function createDownloadLink(blob, filename, type) {
    const url = URL.createObjectURL(blob);
    
    const downloadItem = document.createElement('div');
    downloadItem.className = 'download-link';
    
    const filenameSpan = document.createElement('span');
    filenameSpan.textContent = filename;
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.className = 'download-button';
    downloadLink.textContent = `Download ${type}`;
    
    downloadItem.appendChild(filenameSpan);
    downloadItem.appendChild(downloadLink);
    
    // Clear previous download links
    elements.downloadContainer.innerHTML = '<h3>Download Files</h3>';
    elements.downloadContainer.appendChild(downloadItem);
    
    // Auto download
    setTimeout(() => {
        downloadLink.click();
    }, 1000);
}

// Batch Processing Section
function setupBatchProcessing() {
    // File input change
    elements.batchFileInput.addEventListener('change', handleBatchFileSelection);
    
    // Drag and drop functionality
    elements.batchDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.batchDropArea.classList.add('highlight');
    });
    
    elements.batchDropArea.addEventListener('dragleave', () => {
        elements.batchDropArea.classList.remove('highlight');
    });
    
    elements.batchDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.batchDropArea.classList.remove('highlight');
        
        if (e.dataTransfer.files.length) {
            handleBatchFileSelection({ target: { files: e.dataTransfer.files } });
        }
    });
    
    // Batch action buttons
    elements.batchSplit.addEventListener('click', () => processBatch('split'));
    elements.batchExtractText.addEventListener('click', () => processBatch('text'));
}

// Handle batch file selection
function handleBatchFileSelection(event) {
    const files = Array.from(event.target.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
        showBatchStatus('No PDF files selected.', 'error');
        return;
    }
    
    // Add files to state
    appState.batchFiles = [...appState.batchFiles, ...pdfFiles];
    
    // Update UI
    updateBatchFilesList();
    showBatchStatus(`${pdfFiles.length} PDF files added to batch.`, 'success');
}

// Update batch files list in UI
function updateBatchFilesList() {
    elements.batchFilesList.innerHTML = '';
    
    appState.batchFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'batch-file-item';
        
        fileItem.innerHTML = `
            <span>${file.name} (${formatFileSize(file.size)})</span>
            <button class="remove-batch-file" data-index="${index}">Remove</button>
        `;
        
        elements.batchFilesList.appendChild(fileItem);
    });
    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-batch-file').forEach(button => {
        button.addEventListener('click', () => {
            const index = parseInt(button.getAttribute('data-index'));
            appState.batchFiles.splice(index, 1);
            updateBatchFilesList();
        });
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    } else {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Process batch of files
async function processBatch(mode) {
    if (appState.batchFiles.length === 0) {
        showBatchStatus('No files in batch.', 'error');
        return;
    }
    
    // Clear previous results
    elements.batchResults.innerHTML = '<h3>Batch Results</h3>';
    
    // Process each file
    for (let i = 0; i < appState.batchFiles.length; i++) {
        const file = appState.batchFiles[i];
        showBatchStatus(`Processing ${i + 1}/${appState.batchFiles.length}: ${file.name}`, 'info');
        
        try {
            // Process file based on mode
            if (mode === 'split') {
                await processBatchSplit(file, i);
            } else {
                await processBatchText(file, i);
            }
            
            // Add success result
            addBatchResult(file.name, true, mode);
            
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            addBatchResult(file.name, false, mode, error.message);
        }
    }
    
    showBatchStatus(`Batch processing complete. ${appState.batchFiles.length} files processed.`, 'success');
}

// Process batch split
async function processBatchSplit(file, index) {
    // Load the PDF
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    
    // Create a new document
    const newPdfDoc = await PDFLib.PDFDocument.create();
    
    // We'll use all pages for batch processing
    const pageCount = pdfDoc.getPageCount();
    
    // Copy all pages to new document
    for (let i = 0; i < pageCount; i++) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
        newPdfDoc.addPage(copiedPage);
    }
    
    // Save new document as bytes
    const pdfBytes = await newPdfDoc.save();
    
    // Create download link
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `${file.name.replace('.pdf', '')}_processed.pdf`;
    
    // Create download link
    createBatchDownloadLink(blob, filename, 'PDF', index);
}

// Process batch text extraction
async function processBatchText(file, index) {
    // Load the PDF with PDF.js
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let extractedText = '';
    
    // Extract text from all pages
    for (let i = 1; i <= pdfJsDoc.numPages; i++) {
        const page = await pdfJsDoc.getPage(i);
        const textContent = await page.getTextContent();
        
        extractedText += `--- Page ${i} ---\n\n`;
        
        // Process text items
        const items = textContent.items;
        let lastY;
        
        for (const item of items) {
            if (lastY !== item.transform[5] && lastY !== undefined) {
                extractedText += '\n';
            }
            
            extractedText += item.str + ' ';
            lastY = item.transform[5];
        }
        
        extractedText += '\n\n';
    }
    
    // Create download link
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const filename = `${file.name.replace('.pdf', '')}.txt`;
    
    // Create download link
    createBatchDownloadLink(blob, filename, 'Text', index);
}

// Create batch download link
function createBatchDownloadLink(blob, filename, type, index) {
    const url = URL.createObjectURL(blob);
    
    const downloadItem = document.createElement('div');
    downloadItem.className = 'download-link';
    downloadItem.innerHTML = `
        <span>${filename}</span>
        <a href="${url}" download="${filename}" class="download-button">Download ${type}</a>
    `;
    
    elements.batchResults.appendChild(downloadItem);
}

// Add batch result
function addBatchResult(filename, success, mode, errorMessage = '') {
    const resultItem = document.createElement('div');
    resultItem.className = `batch-result-item ${success ? 'success' : 'error'}`;
    
    resultItem.innerHTML = `
        <div>
            <strong>${filename}</strong>
            <div class="result-details">${mode === 'split' ? 'PDF Split' : 'Text Extraction'} - ${success ? 'Success' : 'Failed'}</div>
            ${errorMessage ? `<div class="error-message">${errorMessage}</div>` : ''}
        </div>
        <span class="result-status ${success ? 'success' : 'error'}">${success ? '✓' : '✗'}</span>
    `;
    
    elements.batchResults.appendChild(resultItem);
}

// Show batch status
function showBatchStatus(message, type = 'info') {
    elements.batchStatus.textContent = message;
    elements.batchStatus.className = `batch-status ${type}`;
}

// Accessibility controls
function setupAccessibilityControls() {
    // High contrast toggle
    elements.highContrastToggle.addEventListener('click', () => {
        document.body.classList.toggle('high-contrast');
        saveAccessibilityPreferences();
    });
    
    // Large text toggle
    elements.largeTextToggle.addEventListener('click', () => {
        document.body.classList.toggle('large-text');
        saveAccessibilityPreferences();
    });
}

// Save accessibility preferences to localStorage
function saveAccessibilityPreferences() {
    const preferences = {
        highContrast: document.body.classList.contains('high-contrast'),
        largeText: document.body.classList.contains('large-text')
    };
    
    localStorage.setItem('pdfSplitterAccessibility', JSON.stringify(preferences));
}

// Load accessibility preferences from localStorage
function loadAccessibilityPreferences() {
    try {
        const preferences = JSON.parse(localStorage.getItem('pdfSplitterAccessibility')) || {};
        
        if (preferences.highContrast) {
            document.body.classList.add('high-contrast');
        }
        
        if (preferences.largeText) {
            document.body.classList.add('large-text');
        }
    } catch (error) {
        console.error('Error loading accessibility preferences:', error);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
