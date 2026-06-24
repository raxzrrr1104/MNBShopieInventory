// ============================================================
// ScanNGo — Enterprise Frontend Application
// ============================================================

// --- Trusted Types Policy ---
if (window.trustedTypes && window.trustedTypes.createPolicy) {
    if (!window.trustedTypes.defaultPolicy) {
        window.trustedTypes.createPolicy('default', {
            createHTML: (string) => string
        });
    }
}

// --- Global State ---
let inventory = [];
let cart = []; // Current billing items
let discountType = 'percent'; // 'percent' or 'amount'
let discountValue = 0.0;
let activeScanBarcode = '';
let activeScanName = '';
let activeScanSku = '';
let activeScanImage = '';
let activeScanImageUrls = [];
let html5QrcodeScanner = null;
let currentEditingSku = null;
let currentFilter = 'all';
let skuToDelete = '';
let activeMode = 'intake'; // 'intake' or 'bill'
let categories = ['General'];
let activeScanCategory = 'All';

function getPrimaryImage(urlStr) {
    if (!urlStr) return '';
    urlStr = urlStr.trim();
    if (urlStr.startsWith('[')) {
        try {
            const arr = JSON.parse(urlStr);
            if (Array.isArray(arr) && arr.length > 0) {
                return arr[0];
            }
        } catch (e) {}
    }
    return urlStr;
}

function getAllImages(urlStr) {
    if (!urlStr) return [];
    urlStr = urlStr.trim();
    if (urlStr.startsWith('[')) {
        try {
            const arr = JSON.parse(urlStr);
            if (Array.isArray(arr)) {
                return arr;
            }
        } catch (e) {}
    }
    return [urlStr];
}

function renderImageSelectionThumbnails(containerId, inputEl, urlsList, previewCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    if (!urlsList || urlsList.length <= 1) {
        return;
    }
    
    // Clean list from duplicate or invalid values
    const uniqueUrls = [];
    urlsList.forEach(url => {
        if (url && !uniqueUrls.includes(url)) {
            uniqueUrls.push(url);
        }
    });
    
    uniqueUrls.forEach((url) => {
        if (!url) return;
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '50px';
        img.style.height = '50px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.cursor = 'pointer';
        img.style.border = '2px solid transparent';
        img.style.transition = 'all 0.2s ease';
        img.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        
        // Mark as selected if matching the input value
        if (inputEl.value === url) {
            img.style.borderColor = 'var(--primary)';
            img.style.transform = 'scale(1.05)';
        }
        
        img.onerror = () => {
            img.remove();
        };
        
        img.addEventListener('click', () => {
            inputEl.value = url;
            // Move this URL to index 0 of allImageUrls
            const index = uniqueUrls.indexOf(url);
            if (index > -1) {
                uniqueUrls.splice(index, 1);
                uniqueUrls.unshift(url);
            }
            inputEl._allImageUrls = uniqueUrls;
            
            // Re-render thumbnails to update selected border
            renderImageSelectionThumbnails(containerId, inputEl, uniqueUrls, previewCallback);
            
            if (previewCallback) {
                previewCallback(url);
            }
        });
        
        // Scale up slightly on hover
        img.addEventListener('mouseenter', () => {
            if (inputEl.value !== url) {
                img.style.borderColor = 'var(--border-light)';
                img.style.transform = 'scale(1.03)';
            }
        });
        img.addEventListener('mouseleave', () => {
            if (inputEl.value !== url) {
                img.style.borderColor = 'transparent';
                img.style.transform = 'scale(1)';
            }
        });
        
        container.appendChild(img);
    });
}


// --- DOM References ---
const inventoryBody = document.getElementById('inventoryBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const totalSKUs = document.getElementById('totalSKUs');
const totalQty = document.getElementById('totalQty');
const modeIntakeBtn = document.getElementById('modeIntakeBtn');
const modeBillBtn = document.getElementById('modeBillBtn');
const billWarningModal = document.getElementById('billWarningModal');
const billWarningBarcode = document.getElementById('billWarningBarcode');
const btnRegisterFromBill = document.getElementById('btnRegisterFromBill');
const btnCancelBillWarning = document.getElementById('btnCancelBillWarning');
const kpiScanBtn = document.getElementById('kpiScanBtn');

const startScannerBtn = document.getElementById('startScannerBtn');
const manualBarcode = document.getElementById('manualBarcode');
const manualSubmitBtn = document.getElementById('manualSubmitBtn');

const scannerModal = document.getElementById('scannerModal');
const closeScannerModal = document.getElementById('closeScannerModal');

const qtyModal = document.getElementById('qtyModal');
const qtyInput = document.getElementById('qtyInput');
const qtyMinus = document.getElementById('qtyMinus');
const qtyPlus = document.getElementById('qtyPlus');
const qtyModalProdName = document.getElementById('qtyModalProdName');
const qtyModalNameInput = document.getElementById('qtyModalNameInput');
const qtyModalBarcode = document.getElementById('qtyModalBarcode');
const qtyIntakePrice = document.getElementById('qtyIntakePrice');
const qtySellingPrice = document.getElementById('qtySellingPrice');
const qtyCategory = document.getElementById('qtyCategory');
const cancelQtyBtn = document.getElementById('cancelQtyBtn');
const confirmQtyBtn = document.getElementById('confirmQtyBtn');
const qtyImageUrl = document.getElementById('qtyImageUrl');
const qtyPreviewImg = document.getElementById('qtyPreviewImg');
const qtyPreviewPlaceholder = document.getElementById('qtyPreviewPlaceholder');

const fuzzyModal = document.getElementById('fuzzyModal');
const fuzzyWebName = document.getElementById('fuzzyWebName');
const fuzzyOptionsList = document.getElementById('fuzzyOptionsList');
const createAsNewBtn = document.getElementById('createAsNewBtn');
const cancelFuzzyBtn = document.getElementById('cancelFuzzyBtn');

const registerModal = document.getElementById('registerModal');
const registerBarcode = document.getElementById('registerBarcode');
const registerName = document.getElementById('registerName');
const registerSKU = document.getElementById('registerSKU');
const registerQty = document.getElementById('registerQty');
const registerImage = document.getElementById('registerImage');
const registerIntakePrice = document.getElementById('registerIntakePrice');
const registerSellingPrice = document.getElementById('registerSellingPrice');
const registerCategory = document.getElementById('registerCategory');
const cancelRegisterBtn = document.getElementById('cancelRegisterBtn');
const confirmRegisterBtn = document.getElementById('confirmRegisterBtn');

const editModal = document.getElementById('editModal');
const editSKU = document.getElementById('editSKU');
const editBarcode = document.getElementById('editBarcode');
const editName = document.getElementById('editName');
const editQty = document.getElementById('editQty');
const editImage = document.getElementById('editImage');
const editIntakePrice = document.getElementById('editIntakePrice');
const editSellingPrice = document.getElementById('editSellingPrice');
const editCategory = document.getElementById('editCategory');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const confirmEditBtn = document.getElementById('confirmEditBtn');

const deletePromptModal = document.getElementById('deletePromptModal');
const deleteModalName = document.getElementById('deleteModalName');
const deleteModalSku = document.getElementById('deleteModalSku');

// Manual Product DOM Elements
const manualProductForm = document.getElementById('manualProductForm');
const manualProdName = document.getElementById('manualProdName');
const manualProdSKU = document.getElementById('manualProdSKU');
const manualProdBarcode = document.getElementById('manualProdBarcode');
const manualProdQty = document.getElementById('manualProdQty');
const manualProdIntake = document.getElementById('manualProdIntake');
const manualProdSelling = document.getElementById('manualProdSelling');
const manualProdCategory = document.getElementById('manualProdCategory');
const manualProdImage = document.getElementById('manualProdImage');
const btnRegenManualCodes = document.getElementById('btnRegenManualCodes');
const btnShowManualBarcodes = document.getElementById('btnShowManualBarcodes');

const barcodesSheetModal = document.getElementById('barcodesSheetModal');
const closeBarcodesSheetModal = document.getElementById('closeBarcodesSheetModal');
const barcodesSheetContainer = document.getElementById('barcodesSheetContainer');
const btnPrintBarcodesSheet = document.getElementById('btnPrintBarcodesSheet');
const btnDismissBarcodesSheet = document.getElementById('btnDismissBarcodesSheet');

// Cart & Sales DOM Elements
const cartPanel = document.getElementById('cartPanel');
const clearCartBtn = document.getElementById('clearCartBtn');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartSummary = document.getElementById('cartSummary');
const cartTotalQty = document.getElementById('cartTotalQty');
const cartSubtotalAmount = document.getElementById('cartSubtotalAmount');
const cartDiscountRow = document.getElementById('cartDiscountRow');
const cartDiscountAmount = document.getElementById('cartDiscountAmount');
const cartTotalAmount = document.getElementById('cartTotalAmount');
const cartDiscountValue = document.getElementById('cartDiscountValue');
const discountTypePercent = document.getElementById('discountTypePercent');
const discountTypeAmount = document.getElementById('discountTypeAmount');
const checkoutBtn = document.getElementById('checkoutBtn');

const salesSoldQty = document.getElementById('salesSoldQty');
const salesRevenue = document.getElementById('salesRevenue');
const salesProfit = document.getElementById('salesProfit');
const emailSummaryBtn = document.getElementById('emailSummaryBtn');

const toast = document.getElementById('toast');
const logsContainer = document.getElementById('logsContainer');
const networkLabel = document.getElementById('networkLabel');
const ipText = document.getElementById('ipText');
const mobileUrlText = document.getElementById('mobileUrlText');
const copyUrlBtn = document.getElementById('copyUrlBtn');

const BASE_URL = window.location.origin;

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    fetchInventory();
    fetchSalesSummary();
    fetchNetworkInfo();
    fetchCategories();
    setupEventListeners();
    requestCameraPermission();
    initSettingsManager();
    initManualProductFeature();
    initBillingHistoryFeature();
});

// --- Network Info ---
async function fetchNetworkInfo() {
    try {
        const res = await fetch(`${BASE_URL}/api/network-info`);
        if (res.ok) {
            const data = await res.json();
            networkLabel.textContent = `Online · ${data.ip}`;
            ipText.textContent = data.mobile_url;
            mobileUrlText.textContent = data.mobile_url;
            addLog(`Network ready: ${data.mobile_url}`, 'success');
        }
    } catch (err) {
        networkLabel.textContent = 'Offline';
        ipText.textContent = 'N/A';
        mobileUrlText.textContent = 'Unavailable';
        console.error('Network info error:', err);
    }
}

// --- Camera Permission ---
function requestCameraPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        addLog('Requesting camera permission...', 'system');
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                stream.getTracks().forEach(t => t.stop());
                addLog('Camera access granted.', 'success');
            })
            .catch(err => {
                addLog('Camera permission denied. Enable in browser settings.', 'error');
            });
    } else {
        addLog('Camera API unavailable. HTTPS required for mobile.', 'error');
    }
}

async function fetchCategories() {
    try {
        const res = await fetch(`${BASE_URL}/api/categories`);
        if (res.ok) {
            const data = await res.json();
            categories = data.categories || ['General'];
            updateCategoryElements();
        }
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

function updateCategoryElements() {
    const dropdowns = [qtyCategory, registerCategory, editCategory, manualProdCategory];
    dropdowns.forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            sel.appendChild(opt);
        });
        if (categories.includes(currentVal)) {
            sel.value = currentVal;
        } else {
            sel.value = 'General';
        }
    });

    const chipsContainer = document.getElementById('categorySelectionChips');
    if (chipsContainer) {
        chipsContainer.innerHTML = '';
        const allChips = ['All', ...categories];
        allChips.forEach(cat => {
            const chipWrapper = document.createElement('div');
            chipWrapper.style.display = 'inline-flex';
            chipWrapper.style.alignItems = 'center';
            chipWrapper.style.background = cat === activeScanCategory ? 'var(--primary)' : 'var(--bg-card)';
            chipWrapper.style.color = cat === activeScanCategory ? '#fff' : 'var(--text-primary)';
            chipWrapper.style.border = '1px solid var(--border-strong)';
            chipWrapper.style.borderRadius = '20px';
            chipWrapper.style.padding = '0.2rem 0.75rem';
            chipWrapper.style.marginRight = '6px';
            chipWrapper.style.marginBottom = '6px';
            chipWrapper.style.fontSize = '0.8rem';
            chipWrapper.style.fontWeight = '600';
            chipWrapper.style.cursor = 'pointer';
            chipWrapper.style.transition = 'var(--transition)';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = cat;
            nameSpan.addEventListener('click', () => {
                activeScanCategory = cat;
                document.getElementById('activeScanCategoryLabel').textContent = cat;
                updateCategoryElements();
                filterInventory();
            });
            chipWrapper.appendChild(nameSpan);

            if (cat !== 'General' && cat !== 'All') {
                const deleteBtn = document.createElement('button');
                deleteBtn.style.background = 'none';
                deleteBtn.style.border = 'none';
                deleteBtn.style.color = cat === activeScanCategory ? '#ff9b9b' : 'var(--danger)';
                deleteBtn.style.marginLeft = '8px';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.fontSize = '0.85rem';
                deleteBtn.style.fontWeight = '800';
                deleteBtn.style.padding = '0 2px';
                deleteBtn.innerHTML = '×';
                deleteBtn.title = `Delete ${cat}`;
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Are you sure you want to delete category "${cat}"? Products in this category will default to "General".`)) {
                        return;
                    }
                    try {
                        const res = await fetch(`${BASE_URL}/api/categories/delete`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: cat })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            categories = data.categories || ['General'];
                            if (activeScanCategory === cat) {
                                activeScanCategory = 'General';
                                document.getElementById('activeScanCategoryLabel').textContent = 'General';
                            }
                            showToast(`Category "${cat}" deleted`);
                            updateCategoryElements();
                            fetchInventory();
                        } else {
                            showToast('Failed to delete category', 'error');
                        }
                    } catch (err) {
                        showToast('Failed to delete category', 'error');
                    }
                });
                chipWrapper.appendChild(deleteBtn);
            }
            chipsContainer.appendChild(chipWrapper);
        });
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    searchInput.addEventListener('input', filterInventory);

    exportBtn.addEventListener('click', () => {
        window.location.href = `${BASE_URL}/api/inventory/export`;
        addLog('CSV export initiated.', 'system');
    });

    startScannerBtn.addEventListener('click', openScanner);
    closeScannerModal.addEventListener('click', closeScanner);

    manualSubmitBtn.addEventListener('click', () => {
        const val = manualBarcode.value.trim();
        if (val) { handleScannedBarcode(val); manualBarcode.value = ''; }
        else showToast('Enter a barcode first', 'error');
    });
    manualBarcode.addEventListener('keypress', e => { if (e.key === 'Enter') manualSubmitBtn.click(); });

    // Qty Modal
    qtyMinus.addEventListener('click', () => { let v = parseInt(qtyInput.value) || 1; if (v > 1) qtyInput.value = v - 1; });
    qtyPlus.addEventListener('click', () => { qtyInput.value = (parseInt(qtyInput.value) || 1) + 1; });
    cancelQtyBtn.addEventListener('click', () => closeModal(qtyModal));
    confirmQtyBtn.addEventListener('click', submitQuantityUpdate);

    qtyModalNameInput.addEventListener('input', () => {
        qtyModalProdName.textContent = qtyModalNameInput.value.trim() || '—';
    });

    qtyImageUrl.addEventListener('input', () => {
        const url = qtyImageUrl.value.trim();
        if (!qtyImageUrl._allImageUrls) qtyImageUrl._allImageUrls = [];
        if (url) {
            if (qtyImageUrl._allImageUrls.length > 0) {
                qtyImageUrl._allImageUrls[0] = url;
            } else {
                qtyImageUrl._allImageUrls.push(url);
            }
        }
        activeScanImage = JSON.stringify(qtyImageUrl._allImageUrls);
        updateQtyPreviewImage(url);
        renderImageSelectionThumbnails('qtyImageUrlThumbnails', qtyImageUrl, qtyImageUrl._allImageUrls, updateQtyPreviewImage);
    });

    // Fuzzy
    createAsNewBtn.addEventListener('click', () => { closeModal(fuzzyModal); openQtyModal(activeScanName, activeScanBarcode, activeScanSku, activeScanImage, activeScanImageUrls); });
    cancelFuzzyBtn.addEventListener('click', () => closeModal(fuzzyModal));

    // Register
    cancelRegisterBtn.addEventListener('click', () => closeModal(registerModal));
    confirmRegisterBtn.addEventListener('click', submitRegistration);
    registerImage.addEventListener('input', () => {
        const url = registerImage.value.trim();
        if (!registerImage._allImageUrls) registerImage._allImageUrls = [];
        if (url) {
            if (registerImage._allImageUrls.length > 0) {
                registerImage._allImageUrls[0] = url;
            } else {
                registerImage._allImageUrls.push(url);
            }
        }
        renderImageSelectionThumbnails('registerImageThumbnails', registerImage, registerImage._allImageUrls);
    });

    // Edit
    cancelEditBtn.addEventListener('click', () => closeModal(editModal));
    confirmEditBtn.addEventListener('click', submitEditUpdate);
    editImage.addEventListener('input', () => {
        const url = editImage.value.trim();
        if (!editImage._allImageUrls) editImage._allImageUrls = [];
        if (url) {
            if (editImage._allImageUrls.length > 0) {
                editImage._allImageUrls[0] = url;
            } else {
                editImage._allImageUrls.push(url);
            }
        }
        renderImageSelectionThumbnails('editImageThumbnails', editImage, editImage._allImageUrls);
    });

    // Manual add input listener
    const manProdImg = document.getElementById('manualProdImage');
    if (manProdImg) {
        manProdImg.addEventListener('input', () => {
            const url = manProdImg.value.trim();
            if (!manProdImg._allImageUrls) manProdImg._allImageUrls = [];
            if (url) {
                if (manProdImg._allImageUrls.length > 0) {
                    manProdImg._allImageUrls[0] = url;
                } else {
                    manProdImg._allImageUrls.push(url);
                }
            }
            renderImageSelectionThumbnails('manualProdImageThumbnails', manProdImg, manProdImg._allImageUrls);
        });
    }

    // Manage Categories
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const newCategoryName = document.getElementById('newCategoryName');
    if (addCategoryBtn && newCategoryName) {
        addCategoryBtn.addEventListener('click', async () => {
            const name = newCategoryName.value.trim();
            if (!name) {
                showToast('Category name cannot be empty', 'error');
                return;
            }
            try {
                const res = await fetch(`${BASE_URL}/api/categories/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    const data = await res.json();
                    categories = data.categories || ['General'];
                    newCategoryName.value = '';
                    showToast(`Category "${name}" added`);
                    updateCategoryElements();
                } else {
                    showToast('Failed to add category', 'error');
                }
            } catch (err) {
                showToast('Failed to add category', 'error');
            }
        });
    }

    // Filter
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            filterInventory();
        });
    });

    // Auto-search image by product name in register modal
    let nameTimeout = null;
    registerName.addEventListener('input', () => {
        clearTimeout(nameTimeout);
        const name = registerName.value.trim();
        const status = document.getElementById('nameSearchStatus');
        if (name.length < 3) { status.textContent = ''; return; }
        status.textContent = '🔍 Waiting...';
        status.style.color = 'var(--text-tertiary)';
        nameTimeout = setTimeout(async () => {
            status.textContent = '⚡ Searching...';
            status.style.color = 'var(--primary)';
            try {
                const res = await fetch(`${BASE_URL}/api/search/image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.image_url) {
                        registerImage.value = data.image_url;
                        registerImage._allImageUrls = data.image_urls || [data.image_url];
                        renderImageSelectionThumbnails('registerImageThumbnails', registerImage, registerImage._allImageUrls);
                        status.textContent = '✅ Image found!';
                        status.style.color = 'var(--green)';
                    } else {
                        status.textContent = '❌ No image found.';
                        status.style.color = 'var(--red)';
                    }
                }
            } catch (err) { status.textContent = ''; }
        }, 800);
    });

    let manualNameTimeout = null;
    const manualProdNameEl = document.getElementById('manualProdName');
    const manualProdImageEl = document.getElementById('manualProdImage');
    if (manualProdNameEl && manualProdImageEl) {
        manualProdNameEl.addEventListener('input', () => {
            clearTimeout(manualNameTimeout);
            const name = manualProdNameEl.value.trim();
            const status = document.getElementById('manualNameSearchStatus');
            if (name.length < 3) { if (status) status.textContent = ''; return; }
            if (status) {
                status.textContent = '🔍 Waiting...';
                status.style.color = 'var(--text-tertiary)';
            }
            manualNameTimeout = setTimeout(async () => {
                if (status) {
                    status.textContent = '⚡ Searching...';
                    status.style.color = 'var(--primary)';
                }
                try {
                    const res = await fetch(`${BASE_URL}/api/search/image`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.image_url) {
                            manualProdImageEl.value = data.image_url;
                            manualProdImageEl._allImageUrls = data.image_urls || [data.image_url];
                            renderImageSelectionThumbnails('manualProdImageThumbnails', manualProdImageEl, manualProdImageEl._allImageUrls);
                            if (status) {
                                status.textContent = '✅ Image found!';
                                status.style.color = 'var(--green)';
                            }
                        } else {
                            if (status) {
                                status.textContent = '❌ No image found.';
                                status.style.color = 'var(--red)';
                            }
                        }
                    }
                } catch (err) { if (status) status.textContent = ''; }
            }, 800);
        });
    }

    // Delete
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal(deletePromptModal));
    document.getElementById('confirmDeleteBtn').addEventListener('click', submitProductDelete);

    // Copy URL
    copyUrlBtn.addEventListener('click', () => {
        const url = mobileUrlText.textContent;
        navigator.clipboard.writeText(url).then(() => showToast('URL copied!')).catch(() => {});
    });

    // Mode Switcher Buttons
    modeIntakeBtn.addEventListener('click', () => setScannerMode('intake'));
    modeBillBtn.addEventListener('click', () => setScannerMode('bill'));
    kpiScanBtn.addEventListener('click', openScanner);

    // Bill Warning Modal Buttons
    btnCancelBillWarning.addEventListener('click', () => closeModal(billWarningModal));
    btnRegisterFromBill.addEventListener('click', () => {
        closeModal(billWarningModal);
        openRegisterModal(activeScanBarcode);
    });

    // Discount listeners
    cartDiscountValue.addEventListener('input', () => {
        discountValue = parseFloat(cartDiscountValue.value) || 0.0;
        updateCartTotalsOnly();
    });
    discountTypePercent.addEventListener('click', () => {
        discountType = 'percent';
        discountTypePercent.classList.add('active');
        discountTypePercent.style.background = 'var(--primary)';
        discountTypePercent.style.color = '#fff';
        discountTypeAmount.classList.remove('active');
        discountTypeAmount.style.background = 'transparent';
        discountTypeAmount.style.color = 'var(--text-primary)';
        updateCartTotalsOnly();
    });
    discountTypeAmount.addEventListener('click', () => {
        discountType = 'amount';
        discountTypeAmount.classList.add('active');
        discountTypeAmount.style.background = 'var(--primary)';
        discountTypeAmount.style.color = '#fff';
        discountTypePercent.classList.remove('active');
        discountTypePercent.style.background = 'transparent';
        discountTypePercent.style.color = 'var(--text-primary)';
        updateCartTotalsOnly();
    });

    // Physical Hardware Barcode Scanner key listener
    let scannerBuffer = '';
    let lastKeyTime = Date.now();
    window.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        
        const now = Date.now();
        const diff = now - lastKeyTime;
        lastKeyTime = now;
        
        if (e.key.length === 1) {
            if (diff <= 50 || scannerBuffer.length === 0) {
                // If it is a rapid entry stream, prevent writing it into focused input
                if (scannerBuffer.length > 0 && diff <= 50) {
                    e.preventDefault();
                }
                scannerBuffer += e.key;
            } else {
                // Manual/slow typing
                scannerBuffer = e.key;
            }
        } else if (e.key === 'Enter') {
            if (scannerBuffer.length >= 8) {
                e.preventDefault();
                const barcode = scannerBuffer;
                scannerBuffer = '';
                addLog(`Scanner detected: ${barcode}`, 'success');
                handleScannedBarcode(barcode);
            } else {
                scannerBuffer = '';
            }
        }
    });

    // Cart & Sales Events
    clearCartBtn.addEventListener('click', clearCart);
    checkoutBtn.addEventListener('click', submitBillingCheckout);
    emailSummaryBtn.addEventListener('click', triggerEmailSummary);
}

function setScannerMode(mode) {
    activeMode = mode;
    if (mode === 'intake') {
        modeIntakeBtn.classList.add('active');
        modeBillBtn.classList.remove('active');
        addLog('Scanner Mode: Intake', 'system');
        showToast('Intake Mode activated');
    } else {
        modeIntakeBtn.classList.remove('active');
        modeBillBtn.classList.add('active');
        addLog('Scanner Mode: Bill', 'system');
        showToast('Bill Mode activated');
    }
}

// --- Inventory CRUD ---
async function fetchInventory() {
    try {
        const res = await fetch(`${BASE_URL}/api/inventory`);
        if (!res.ok) throw new Error('Failed');
        inventory = await res.json();
        renderInventory();
        updateStats();
        updateFilterBadges();
        updateChart();
    } catch (err) {
        addLog('Error loading inventory.', 'error');
    }
}

function renderInventory() {
    inventoryBody.innerHTML = '';
    if (inventory.length === 0) { emptyState.style.display = 'flex'; return; }
    emptyState.style.display = 'none';

    inventory.forEach(item => {
        const row = document.createElement('tr');
        const qty = item.quantity;
        let badgeClass = 'stock-in';
        let badgeText = `${qty} units`;
        if (qty === 0) { badgeClass = 'stock-out'; badgeText = 'Out of stock'; }
        else if (qty <= 5) { badgeClass = 'stock-low'; badgeText = `${qty} units`; }

        const primaryImg = getPrimaryImage(item.image_url);
        const imgHtml = primaryImg
            ? `<img src="${primaryImg}" class="prod-img" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\\'prod-img-placeholder\\'>📦</div>';">`
            : `<div class="prod-img-placeholder">📦</div>`;

        const escapedName = item.name.replace(/'/g, "\\'");
        
        const intakePriceText = item.intake_price > 0 ? `Rs. ${item.intake_price.toFixed(2)}` : '—';
        const sellingPriceText = item.selling_price > 0 ? `Rs. ${item.selling_price.toFixed(2)}` : '—';
        const avgSellingPriceText = item.avg_selling_price > 0 ? `Rs. ${item.avg_selling_price.toFixed(2)}` : '—';

        row.innerHTML = `
            <td>
                <div class="prod-cell">
                    ${imgHtml}
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <span class="prod-name">${item.name}</span>
                        <span class="category-badge" style="font-size: 0.7rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.15rem 0.45rem; border-radius: 4px; align-self: flex-start; text-transform: uppercase;">${item.category || 'General'}</span>
                    </div>
                </div>
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:0.3rem;">
                    <span class="sku-mono">${item.sku}</span>
                    <span class="barcode-mono">${item.barcode}</span>
                </div>
            </td>
            <td>
                <div class="pricing-cell">
                    <div><span class="pricing-label">In: </span><span class="pricing-value intake">${intakePriceText}</span></div>
                    <div><span class="pricing-label">Sell: </span><span class="pricing-value selling">${sellingPriceText}</span></div>
                    <div><span class="pricing-label">Out: </span><span class="pricing-value avg-out">${avgSellingPriceText}</span></div>
                </div>
            </td>
            <td><span class="stock-badge ${badgeClass}">${badgeText}</span></td>
            <td class="text-right">
                <div class="action-cell">
                    <button class="btn-action bill" onclick="addToCart('${item.sku}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                        Bill
                    </button>
                    <button class="btn-action edit" onclick="openEditModal('${item.sku}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                    </button>
                    <button class="btn-action delete" onclick="confirmDelete('${item.sku}', '${escapedName}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Del
                    </button>
                </div>
            </td>
        `;
        inventoryBody.appendChild(row);
    });
    filterInventory();
}

function filterInventory() {
    const q = searchInput.value.toLowerCase().trim();
    const rows = inventoryBody.querySelectorAll('tr');
    inventory.forEach((item, i) => {
        const row = rows[i];
        if (!row) return;
        const matchSearch = item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q) || item.barcode.includes(q);
        
        let matchFilter = true;
        if (currentFilter === 'instock') matchFilter = item.quantity > 5;
        else if (currentFilter === 'lowstock') matchFilter = item.quantity > 0 && item.quantity <= 5;
        else if (currentFilter === 'outofstock') matchFilter = item.quantity === 0;

        const matchCategory = (activeScanCategory === 'All' || item.category === activeScanCategory);

        row.style.display = (matchSearch && matchFilter && matchCategory) ? '' : 'none';
    });
}

function updateFilterBadges() {
    document.getElementById('badgeAll').textContent = inventory.length;
    document.getElementById('badgeInStock').textContent = inventory.filter(i => i.quantity > 5).length;
    document.getElementById('badgeLowStock').textContent = inventory.filter(i => i.quantity > 0 && i.quantity <= 5).length;
    document.getElementById('badgeOutOfStock').textContent = inventory.filter(i => i.quantity === 0).length;
}

function updateStats() {
    totalSKUs.textContent = inventory.length;
    totalQty.textContent = inventory.reduce((s, i) => s + i.quantity, 0);

    const breakdownContainer = document.getElementById('categoryBreakdown');
    if (breakdownContainer) {
        breakdownContainer.innerHTML = '';
        const totals = {};
        
        // Sum quantities for each category present in current inventory
        inventory.forEach(item => {
            const cat = item.category || 'General';
            totals[cat] = (totals[cat] || 0) + (item.quantity || 0);
        });

        // Add entries for any categories that have zero stock
        if (typeof categories !== 'undefined') {
            categories.forEach(cat => {
                if (!totals[cat]) {
                    totals[cat] = 0;
                }
            });
        }

        // Render each category's total units
        const sortedCats = Object.keys(totals).sort();
        sortedCats.forEach(cat => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '0.75rem';
            row.innerHTML = `<span style="font-weight: 500;">${cat}</span><span style="font-weight: 700; color: var(--success);">${totals[cat]}</span>`;
            breakdownContainer.appendChild(row);
        });
    }
}

// --- Chart ---
let stockChartInstance = null;
function updateChart() {
    const ctx = document.getElementById('stockChart');
    if (!ctx) return;
    const inStock = inventory.filter(i => i.quantity > 5).length;
    const lowStock = inventory.filter(i => i.quantity > 0 && i.quantity <= 5).length;
    const outOfStock = inventory.filter(i => i.quantity === 0).length;

    const data = {
        labels: ['In Stock', 'Low Stock', 'Out of Stock'],
        datasets: [{
            data: [inStock, lowStock, outOfStock],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0
        }]
    };

    if (stockChartInstance) {
        stockChartInstance.data = data;
        stockChartInstance.update();
    } else {
        stockChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#475569',
                            font: { family: 'Inter', size: 11, weight: '600' },
                            padding: 12,
                            usePointStyle: true,
                            pointStyleWidth: 8
                        }
                    }
                },
                cutout: '72%'
            }
        });
    }
}

async function handleScannedBarcode(barcode) {
    addLog(`Scanned: ${barcode}`, 'system');

    if (activeMode === 'bill') {
        const existing = inventory.find(p => p.barcode === barcode);
        if (existing) {
            addToCart(existing.sku);
        } else {
            activeScanBarcode = barcode;
            billWarningBarcode.textContent = barcode;
            openModal(billWarningModal);
            addLog(`Product not in inventory: ${barcode}. Cannot bill.`, 'warning');
            showToast('Product not found in inventory', 'error');
        }
        return;
    }

    if (activeMode === 'intake' && activeScanCategory === 'All') {
        showToast('Select a specific category first', 'error');
        alert('Please select a specific category from the Active Scan Category bar first to scan/intake products.');
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode })
        });
        if (!res.ok) throw new Error('Scan API error');
        const data = await res.json();
        activeScanBarcode = barcode;

        if (data.status === 'exists') {
            addLog(`Found: "${data.product.name}"`, 'success');
            openQtyModal(data.product.name, barcode, data.product.sku, data.product.image_url);
        } else if (data.status === 'similar_found') {
            addLog(`Web match: "${data.web_name}" — similar exists.`, 'warning');
            activeScanName = data.web_name;
            activeScanImage = data.image_url || '';
            activeScanImageUrls = data.image_urls || (data.image_url ? [data.image_url] : []);
            activeScanSku = '';
            openFuzzyModal(data.web_name, data.similar);
        } else if (data.status === 'new_web_match') {
            addLog(`Resolved: "${data.web_name}"`, 'success');
            activeScanName = data.web_name;
            activeScanImage = data.image_url || '';
            activeScanImageUrls = data.image_urls || (data.image_url ? [data.image_url] : []);
            activeScanSku = data.sku;
            openQtyModal(data.web_name, barcode, data.sku, data.image_url, data.image_urls);
        } else {
            addLog(`Barcode "${barcode}" not recognized.`, 'warning');
            activeScanImage = '';
            activeScanImageUrls = [];
            openRegisterModal(barcode);
        }
    } catch (err) {
        addLog('Scan failed — network error.', 'error');
        showToast('Network error', 'error');
    }
}

// --- Modal Helpers ---
function openModal(el) { el.classList.add('active'); }
function closeModal(el) { el.classList.remove('active'); }

// --- Qty Modal ---
function openQtyModal(name, barcode, sku, image_url = '', image_urls = null) {
    qtyModalProdName.textContent = name;
    qtyModalNameInput.value = name;
    qtyModalBarcode.textContent = barcode;
    qtyInput.value = '1';
    activeScanName = name;
    activeScanBarcode = barcode;
    activeScanSku = sku;
    
    // Look up if product already exists to prefill details
    const existing = inventory.find(p => p.sku === sku || p.barcode === barcode);
    const dbImg = existing ? existing.image_url : '';
    
    // Determine image list:
    let allImgs = [];
    if (image_urls && image_urls.length > 0) {
        allImgs = image_urls;
    } else if (dbImg) {
        allImgs = getAllImages(dbImg);
    } else if (image_url) {
        allImgs = getAllImages(image_url);
    }
    
    const primaryImg = allImgs.length > 0 ? allImgs[0] : (image_url || '');
    qtyImageUrl.value = primaryImg;
    qtyImageUrl._allImageUrls = allImgs;
    activeScanImage = JSON.stringify(allImgs); // Keep activeScanImage as serialized array
    
    qtyIntakePrice.value = (existing && existing.intake_price) ? existing.intake_price : '';
    qtySellingPrice.value = (existing && existing.selling_price) ? existing.selling_price : '';
    qtyCategory.value = (existing && existing.category) ? existing.category : activeScanCategory;
    
    updateQtyPreviewImage(primaryImg);
    renderImageSelectionThumbnails('qtyImageUrlThumbnails', qtyImageUrl, allImgs, updateQtyPreviewImage);
    
    openModal(qtyModal);
    qtyInput.focus();
}

function updateQtyPreviewImage(url) {
    if (url) {
        qtyPreviewImg.src = url;
        qtyPreviewImg.style.display = 'block';
        qtyPreviewPlaceholder.style.display = 'none';
        qtyPreviewImg.onerror = () => {
            qtyPreviewImg.style.display = 'none';
            qtyPreviewPlaceholder.style.display = 'flex';
        };
    } else {
        qtyPreviewImg.style.display = 'none';
        qtyPreviewImg.src = '';
        qtyPreviewPlaceholder.style.display = 'flex';
    }
}

async function submitQuantityUpdate() {
    const qty = parseInt(qtyInput.value) || 0;
    if (qty <= 0) { showToast('Invalid quantity', 'error'); return; }
    
    const intakeVal = parseFloat(qtyIntakePrice.value.trim());
    const sellingVal = parseFloat(qtySellingPrice.value.trim());
    const categoryVal = qtyCategory.value.trim() || 'General';
    
    let finalImageUrl = qtyImageUrl.value.trim();
    if (qtyImageUrl._allImageUrls && qtyImageUrl._allImageUrls.length > 0) {
        const currentVal = qtyImageUrl.value.trim();
        const urls = [...qtyImageUrl._allImageUrls];
        if (currentVal && urls.indexOf(currentVal) === -1) {
            urls.unshift(currentVal);
        } else if (currentVal && urls.indexOf(currentVal) > 0) {
            const index = urls.indexOf(currentVal);
            urls.splice(index, 1);
            urls.unshift(currentVal);
        }
        finalImageUrl = JSON.stringify(urls);
    } else if (activeScanImage) {
        finalImageUrl = activeScanImage;
    }
    
    const payload = {
        barcode: activeScanBarcode,
        sku: activeScanSku,
        name: qtyModalNameInput.value.trim() || activeScanName,
        quantity: qty,
        image_url: finalImageUrl,
        category: categoryVal
    };
    if (!isNaN(intakeVal)) {
        payload.intake_price = intakeVal;
    }
    if (!isNaN(sellingVal)) {
        payload.selling_price = sellingVal;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/inventory/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Update failed');
        const data = await res.json();
        closeModal(qtyModal);
        inventory = data.inventory;
        renderInventory();
        updateStats();
        updateFilterBadges();
        updateChart();
        addLog(`Updated "${activeScanName}" +${qty}`, 'success');
        showToast(`+${qty} units added`);
    } catch (err) {
        showToast('Update failed', 'error');
    }
}

// --- Fuzzy Modal ---
function openFuzzyModal(webName, similarProducts) {
    fuzzyWebName.textContent = webName;
    fuzzyOptionsList.innerHTML = '';
    similarProducts.forEach(prod => {
        const opt = document.createElement('div');
        opt.className = 'fuzzy-option';
        opt.innerHTML = `
            <div class="fuzzy-option-details">
                <span class="fuzzy-option-name">${prod.name}</span>
                <span class="fuzzy-option-meta">SKU: ${prod.sku} · Stock: ${prod.quantity}</span>
            </div>
            <button class="btn-sm">Merge</button>
        `;
        opt.addEventListener('click', () => {
            closeModal(fuzzyModal);
            openQtyModal(prod.name, activeScanBarcode, prod.sku, prod.image_url || activeScanImage, activeScanImageUrls);
        });
        fuzzyOptionsList.appendChild(opt);
    });
    openModal(fuzzyModal);
}

// --- Register Modal ---
function openRegisterModal(barcode) {
    registerBarcode.textContent = barcode;
    registerName.value = '';
    registerSKU.value = '';
    registerQty.value = '1';
    registerImage.value = activeScanImage || '';
    registerIntakePrice.value = '';
    registerSellingPrice.value = '';
    registerCategory.value = activeScanCategory;
    openModal(registerModal);
    setTimeout(() => registerName.focus(), 100);
}

async function submitRegistration() {
    const name = registerName.value.trim();
    const sku = registerSKU.value.trim();
    const qty = parseInt(registerQty.value) || 0;
    if (!name) { showToast('Name required', 'error'); return; }
    if (qty <= 0) { showToast('Quantity must be > 0', 'error'); return; }

    const intakeVal = parseFloat(registerIntakePrice.value.trim());
    const sellingVal = parseFloat(registerSellingPrice.value.trim());
    const categoryVal = registerCategory.value.trim() || 'General';
    
    let finalImageUrl = registerImage.value.trim();
    if (registerImage._allImageUrls && registerImage._allImageUrls.length > 0) {
        const currentVal = registerImage.value.trim();
        const urls = [...registerImage._allImageUrls];
        if (currentVal && urls.indexOf(currentVal) === -1) {
            urls.unshift(currentVal);
        } else if (currentVal && urls.indexOf(currentVal) > 0) {
            const index = urls.indexOf(currentVal);
            urls.splice(index, 1);
            urls.unshift(currentVal);
        }
        finalImageUrl = JSON.stringify(urls);
    }
    
    const payload = {
        barcode: activeScanBarcode,
        sku,
        name,
        quantity: qty,
        image_url: finalImageUrl,
        category: categoryVal
    };
    if (!isNaN(intakeVal)) {
        payload.intake_price = intakeVal;
    }
    if (!isNaN(sellingVal)) {
        payload.selling_price = sellingVal;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/inventory/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Registration failed');
        const data = await res.json();
        closeModal(registerModal);
        inventory = data.inventory;
        renderInventory();
        updateStats();
        updateFilterBadges();
        updateChart();
        addLog(`Registered: "${name}" (${qty} units)`, 'success');
        showToast('Product registered!');
    } catch (err) {
        showToast('Registration failed', 'error');
    }
}

// --- Edit Modal ---
function openEditModal(sku) {
    const item = inventory.find(p => p.sku === sku);
    if (!item) return;
    currentEditingSku = sku;
    editSKU.value = item.sku;
    editBarcode.value = item.barcode;
    editName.value = item.name;
    editQty.value = item.quantity;
    
    const allImgs = getAllImages(item.image_url);
    const primaryImg = allImgs.length > 0 ? allImgs[0] : (item.image_url || '');
    editImage.value = primaryImg;
    editImage._allImageUrls = allImgs;
    
    editIntakePrice.value = item.intake_price || '';
    editSellingPrice.value = item.selling_price || '';
    editCategory.value = item.category || 'General';
    
    renderImageSelectionThumbnails('editImageThumbnails', editImage, allImgs);
    
    openModal(editModal);
}

async function submitEditUpdate() {
    const name = editName.value.trim();
    const qty = parseInt(editQty.value);
    if (!name) { showToast('Name required', 'error'); return; }
    if (isNaN(qty) || qty < 0) { showToast('Invalid quantity', 'error'); return; }

    const intakeVal = parseFloat(editIntakePrice.value.trim()) || 0.0;
    const sellingVal = parseFloat(editSellingPrice.value.trim()) || 0.0;
    const categoryVal = editCategory.value.trim() || 'General';

    let finalImageUrl = editImage.value.trim();
    if (editImage._allImageUrls && editImage._allImageUrls.length > 0) {
        const currentVal = editImage.value.trim();
        const urls = [...editImage._allImageUrls];
        if (currentVal && urls.indexOf(currentVal) === -1) {
            urls.unshift(currentVal);
        } else if (currentVal && urls.indexOf(currentVal) > 0) {
            const index = urls.indexOf(currentVal);
            urls.splice(index, 1);
            urls.unshift(currentVal);
        }
        finalImageUrl = JSON.stringify(urls);
    }

    try {
        const res = await fetch(`${BASE_URL}/api/inventory/edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku: currentEditingSku,
                barcode: editBarcode.value.trim(),
                name,
                quantity: qty,
                image_url: finalImageUrl,
                intake_price: intakeVal,
                selling_price: sellingVal,
                category: categoryVal
            })
        });
        if (!res.ok) throw new Error('Edit failed');
        const data = await res.json();
        closeModal(editModal);
        inventory = data.inventory;
        renderInventory();
        updateStats();
        updateFilterBadges();
        updateChart();
        addLog(`Edited SKU: ${currentEditingSku}`, 'system');
        showToast('Changes saved');
    } catch (err) {
        showToast('Save failed', 'error');
    }
}

// --- Delete ---
function confirmDelete(sku, name) {
    skuToDelete = sku;
    deleteModalName.textContent = name;
    deleteModalSku.textContent = sku;
    openModal(deletePromptModal);
}

async function submitProductDelete() {
    if (!skuToDelete) return;
    try {
        const res = await fetch(`${BASE_URL}/api/inventory/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: skuToDelete })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Delete failed');
        }
        closeModal(deletePromptModal);
        inventory = data.inventory;
        renderInventory();
        updateStats();
        updateFilterBadges();
        updateChart();
        addLog(`Deleted SKU: ${skuToDelete}`, 'warning');
        showToast('Product deleted');
        skuToDelete = '';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- Scanner ---
function openScanner() {
    if (activeMode === 'intake' && activeScanCategory === 'All') {
        showToast('Select a specific category first', 'error');
        alert('Please select a specific category from the Active Scan Category bar first.');
        return;
    }
    openModal(scannerModal);
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => { closeScanner(); handleScannedBarcode(text); },
        () => {}
    ).catch(err => {
        addLog('Camera failed. Check permissions.', 'error');
        showToast('Camera error', 'error');
        closeScanner();
    });
}

function closeScanner() {
    closeModal(scannerModal);
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(() => { html5QrcodeScanner = null; });
    }
}

// --- Utilities ---
function addLog(msg, type = 'system') {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const el = document.createElement('div');
    el.className = `log-entry log-${type}`;
    el.textContent = `[${t}] ${msg}`;
    logsContainer.appendChild(el);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

function showToast(msg, type = 'success') {
    toast.textContent = msg;
    if (type === 'error') {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    toast.style.background = ''; // Clear inline styles so class style can take effect
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3000);
}

// --- Billing & Cart Logic ---
window.addToCart = function(sku) {
    const item = inventory.find(p => p.sku === sku);
    if (!item) return;
    
    if (item.quantity <= 0) {
        showToast('Item is out of stock', 'error');
        return;
    }
    
    const existing = cart.find(c => c.sku === sku);
    if (existing) {
        if (existing.quantity >= item.quantity) {
            showToast(`Only ${item.quantity} units available in stock`, 'error');
            return;
        }
        existing.quantity += 1;
    } else {
        const suggestedPrice = item.selling_price > 0 ? item.selling_price : 0.0;
        cart.push({
            sku: item.sku,
            name: item.name,
            quantity: 1,
            maxQuantity: item.quantity,
            sold_price: suggestedPrice,
            image_url: item.image_url || ''
        });
    }
    
    renderCart();
    showToast(`${item.name} added to cart`);
};

window.removeFromCart = function(sku) {
    cart = cart.filter(c => c.sku !== sku);
    renderCart();
};

window.updateCartItemQty = function(sku, change) {
    const item = cart.find(c => c.sku === sku);
    if (!item) return;
    
    const newQty = item.quantity + change;
    if (newQty <= 0) {
        window.removeFromCart(sku);
        return;
    }
    
    if (newQty > item.maxQuantity) {
        showToast(`Only ${item.maxQuantity} units available in stock`, 'error');
        return;
    }
    
    item.quantity = newQty;
    renderCart();
};

window.updateCartItemPrice = function(sku, newPrice) {
    const item = cart.find(c => c.sku === sku);
    if (!item) return;
    
    item.sold_price = parseFloat(newPrice) || 0.0;
    
    // We update cart summary totals without full rerender to avoid losing focus
    updateCartTotalsOnly();
};

window.setCartItemQty = function(sku, valueStr, inputEl) {
    const item = cart.find(c => c.sku === sku);
    if (!item) return;
    
    if (valueStr === '') {
        return;
    }
    
    let value = parseInt(valueStr) || 1;
    if (value <= 0) {
        value = 1;
        if (inputEl) inputEl.value = 1;
    }
    
    if (value > item.maxQuantity) {
        showToast(`Only ${item.maxQuantity} units available in stock`, 'error');
        value = item.maxQuantity;
        if (inputEl) inputEl.value = value;
    }
    
    item.quantity = value;
    updateCartTotalsOnly();
};

window.handleCartQtyBlur = function(sku, valueStr, inputEl) {
    const item = cart.find(c => c.sku === sku);
    if (!item) return;
    
    let value = parseInt(valueStr);
    if (isNaN(value) || value <= 0) {
        value = 1;
    }
    if (value > item.maxQuantity) {
        value = item.maxQuantity;
    }
    item.quantity = value;
    inputEl.value = value;
    renderCart();
};

function clearCart() {
    cart = [];
    renderCart();
}

function updateCartTotalsOnly() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.sold_price * item.quantity), 0);
    
    let discount = 0.0;
    if (discountValue > 0 && subtotal > 0) {
        if (discountType === 'percent') {
            discount = subtotal * (discountValue / 100.0);
        } else if (discountType === 'amount') {
            discount = Math.min(discountValue, subtotal);
        }
    }
    
    const total = Math.max(0.0, subtotal - discount);
    
    cartTotalQty.textContent = totalItems;
    cartSubtotalAmount.textContent = `Rs. ${subtotal.toFixed(2)}`;
    
    if (discount > 0) {
        cartDiscountRow.style.display = 'flex';
        cartDiscountAmount.textContent = `-Rs. ${discount.toFixed(2)}`;
    } else {
        cartDiscountRow.style.display = 'none';
    }
    
    cartTotalAmount.textContent = `Rs. ${total.toFixed(2)}`;
}

function renderCart() {
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart-msg">Cart is empty. Click "Bill" on items to add.</div>';
        cartSummary.style.display = 'none';
        clearCartBtn.style.display = 'none';
        return;
    }
    
    cartSummary.style.display = 'flex';
    clearCartBtn.style.display = 'block';
    
    cart.forEach(item => {
        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';
        cartItemEl.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name" title="${item.name}">${item.name}</div>
                <div class="cart-item-meta">SKU: ${item.sku}</div>
            </div>
            <div class="cart-item-actions">
                <div class="qty-stepper">
                    <button class="stepper-btn-xs" onclick="updateCartItemQty('${item.sku}', -1)">−</button>
                    <input type="number" class="cart-item-qty-input" min="1" max="${item.maxQuantity}" value="${item.quantity}" oninput="setCartItemQty('${item.sku}', this.value, this)" onblur="handleCartQtyBlur('${item.sku}', this.value, this)">
                    <button class="stepper-btn-xs" onclick="updateCartItemQty('${item.sku}', 1)">+</button>
                </div>
                <div class="price-container" style="display: flex; align-items: center; justify-content: flex-end; width: 80px;">
                    <span class="currency-label">Rs.</span>
                    <span class="cart-item-price-span" style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); text-align: right;">${item.sold_price.toFixed(2)}</span>
                </div>
                <button class="cart-remove-btn" onclick="removeFromCart('${item.sku}')" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItemEl);
    });
    
    updateCartTotalsOnly();
}

async function submitBillingCheckout() {
    if (cart.length === 0) return;
    
    // Check if any items have empty or invalid price
    for (const item of cart) {
        if (item.sold_price <= 0) {
            showToast(`Please enter a valid selling price for ${item.name}`, 'error');
            return;
        }
    }
    
    const customerEmailInput = document.getElementById('checkoutCustomerEmail');
    const customerEmail = customerEmailInput ? customerEmailInput.value.trim() : '';
    
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Processing...';
    
    try {
        const res = await fetch(`${BASE_URL}/api/billing/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cart,
                customer_email: customerEmail,
                discount_type: discountType,
                discount_value: discountValue
            })
        });
        if (!res.ok) throw new Error('Billing failed');
        const data = await res.json();
        
        let successMsg = 'Billing completed successfully!';
        if (data.email_sent) {
            successMsg += ' Receipt sent via email.';
        } else if (customerEmail && data.email_error) {
            successMsg += ' (Email failed: check SMTP settings)';
        }
        
        showToast(successMsg, data.email_error ? 'warning' : 'success');
        addLog(`Billed ${cart.length} unique products.${customerEmail ? ' Receipt requested to ' + customerEmail : ''}`, 'success');
        
        if (customerEmailInput) customerEmailInput.value = '';
        cart = [];
        renderCart();
        
        inventory = data.inventory;
        renderInventory();
        updateStats();
        updateFilterBadges();
        updateChart();
        
        // Update sales summary cards
        displaySalesSummary(data.summary);
    } catch (err) {
        showToast('Checkout failed', 'error');
    } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Complete Bill';
    }
}

async function fetchSalesSummary() {
    try {
        const res = await fetch(`${BASE_URL}/api/sales/summary`);
        if (res.ok) {
            const data = await res.json();
            displaySalesSummary(data);
        }
    } catch (err) {
        console.error('Error fetching sales summary:', err);
    }
}

function displaySalesSummary(data) {
    if (!data || !data.today) return;
    salesSoldQty.textContent = data.today.total_items_sold;
    salesRevenue.textContent = `Rs. ${data.today.total_amount.toFixed(2)}`;
    salesProfit.textContent = `Rs. ${data.today.total_profit.toFixed(2)}`;
    if (data.today.total_profit < 0) {
        salesProfit.className = 'stat-val text-red';
    } else {
        salesProfit.className = 'stat-val text-green';
    }
}

async function triggerEmailSummary() {
    emailSummaryBtn.disabled = true;
    emailSummaryBtn.innerHTML = 'Sending email...';
    try {
        const res = await fetch(`${BASE_URL}/api/sales/email`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message);
            addLog(data.message, 'success');
        } else {
            // Guide warning or configuration prompt
            if (data.configured === false) {
                alert(data.guide);
                addLog('Email SMTP not configured. Configuration alert shown.', 'warning');
            } else {
                showToast(data.message, 'error');
                addLog(data.message, 'error');
            }
        }
    } catch (err) {
        showToast('Network error sending email', 'error');
    } finally {
        emailSummaryBtn.disabled = false;
        emailSummaryBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="margin-right:4px; vertical-align: middle;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
            Email Daily Summary
        `;
    }
}

// --- Manual Product Features ---
function generateManualSKU() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let sku = 'MAN-';
    for (let i = 0; i < 6; i++) {
        sku += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return sku;
}

function generateManualBarcode() {
    let barcode = '999';
    for (let i = 0; i < 9; i++) {
        barcode += Math.floor(Math.random() * 10).toString();
    }
    return barcode;
}

function populateManualCodes() {
    if (manualProdSKU) manualProdSKU.value = generateManualSKU();
    if (manualProdBarcode) manualProdBarcode.value = generateManualBarcode();
}

function initManualProductFeature() {
    populateManualCodes();

    if (btnRegenManualCodes) {
        btnRegenManualCodes.addEventListener('click', populateManualCodes);
    }

    if (manualProductForm) {
        manualProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = manualProdName.value.trim();
            const sku = manualProdSKU.value.trim();
            const barcode = manualProdBarcode.value.trim();
            const qty = parseInt(manualProdQty.value) || 1;
            const intakePrice = parseFloat(manualProdIntake.value) || 0.0;
            const sellingPrice = parseFloat(manualProdSelling.value) || 0.0;
            const category = manualProdCategory.value;
            let finalImageUrl = manualProdImage.value.trim();
            if (manualProdImage._allImageUrls && manualProdImage._allImageUrls.length > 0) {
                const currentVal = manualProdImage.value.trim();
                const urls = [...manualProdImage._allImageUrls];
                if (currentVal && urls.indexOf(currentVal) === -1) {
                    urls.unshift(currentVal);
                } else if (currentVal && urls.indexOf(currentVal) > 0) {
                    const index = urls.indexOf(currentVal);
                    urls.splice(index, 1);
                    urls.unshift(currentVal);
                }
                finalImageUrl = JSON.stringify(urls);
            }

            if (!name || !sku || !barcode || sellingPrice <= 0) {
                showToast('Invalid manual product details', 'error');
                return;
            }

            const payload = {
                sku,
                barcode,
                name,
                quantity: qty,
                intake_price: intakePrice,
                selling_price: sellingPrice,
                category,
                image_url: finalImageUrl
            };

            try {
                const res = await fetch(`${BASE_URL}/api/inventory/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const data = await res.json();
                    inventory = data.inventory;
                    renderInventory();
                    updateStats();
                    updateFilterBadges();
                    updateChart();
                    showToast(`Manual product "${name}" added`);
                    addLog(`Added Manual Product: ${name}`, 'success');

                    // Reset form fields
                    manualProdName.value = '';
                    manualProdQty.value = '1';
                    manualProdIntake.value = '';
                    manualProdSelling.value = '';
                    manualProdImage.value = '';
                    manualProdImage._allImageUrls = [];
                    const manThumbnails = document.getElementById('manualProdImageThumbnails');
                    if (manThumbnails) manThumbnails.innerHTML = '';
                    populateManualCodes();
                } else {
                    showToast('Failed to add manual product', 'error');
                }
            } catch (err) {
                showToast('Failed to add manual product', 'error');
            }
        });
    }

    // Modal Events
    if (btnShowManualBarcodes) {
        btnShowManualBarcodes.addEventListener('click', showBarcodesSheet);
    }
    if (closeBarcodesSheetModal) {
        closeBarcodesSheetModal.addEventListener('click', () => closeModal(barcodesSheetModal));
    }
    if (btnDismissBarcodesSheet) {
        btnDismissBarcodesSheet.addEventListener('click', () => closeModal(barcodesSheetModal));
    }
    if (btnPrintBarcodesSheet) {
        btnPrintBarcodesSheet.addEventListener('click', () => {
            window.print();
        });
    }
}

function showBarcodesSheet() {
    if (!barcodesSheetContainer) return;
    barcodesSheetContainer.innerHTML = '';
    
    // Filter inventory for manual products (starting with 'MAN-')
    const manualProds = inventory.filter(p => p.sku && p.sku.startsWith('MAN-'));
    
    if (manualProds.length === 0) {
        barcodesSheetContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #666;">No manual products found. Add some manual products first!</div>';
        openModal(barcodesSheetModal);
        return;
    }

    manualProds.forEach((prod, idx) => {
        const card = document.createElement('div');
        card.className = 'barcode-print-card';
        card.style.border = '1px dashed #cbd5e1';
        card.style.borderRadius = '8px';
        card.style.padding = '1.25rem 1rem';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'center';
        card.style.background = '#fff';
        card.style.color = '#000';

        const nameEl = document.createElement('div');
        nameEl.textContent = prod.name;
        nameEl.style.fontWeight = '700';
        nameEl.style.fontSize = '0.95rem';
        nameEl.style.marginBottom = '0.75rem';
        nameEl.style.textAlign = 'center';
        nameEl.style.color = '#1e293b';
        nameEl.style.maxHeight = '2.4rem';
        nameEl.style.overflow = 'hidden';
        card.appendChild(nameEl);

        const primaryImg = getPrimaryImage(prod.image_url);
        if (primaryImg) {
            const imgEl = document.createElement('img');
            imgEl.src = primaryImg;
            imgEl.style.maxWidth = '60px';
            imgEl.style.maxHeight = '60px';
            imgEl.style.objectFit = 'contain';
            imgEl.style.borderRadius = '4px';
            imgEl.style.marginBottom = '0.5rem';
            imgEl.onerror = () => {
                imgEl.style.display = 'none';
            };
            card.appendChild(imgEl);
        }

        const barcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        barcodeSvg.id = `barcode_svg_${idx}`;
        barcodeSvg.style.marginTop = 'auto';
        barcodeSvg.style.width = '100%';
        barcodeSvg.style.height = 'auto';
        barcodeSvg.style.display = 'block';
        card.appendChild(barcodeSvg);

        barcodesSheetContainer.appendChild(card);

        // Draw Code 128 barcode using JsBarcode library in next tick
        setTimeout(() => {
            try {
                JsBarcode(`#barcode_svg_${idx}`, prod.barcode, {
                    format: "CODE128",
                    width: 2,
                    height: 55,
                    displayValue: true,
                    fontSize: 13,
                    fontOptions: "bold",
                    font: "monospace",
                    background: "#ffffff",
                    lineColor: "#000000",
                    margin: 10
                });
            } catch (err) {
                console.error("Error generating barcode with JsBarcode:", err);
            }
        }, 10);
    });

    openModal(barcodesSheetModal);
}

async function initSettingsManager() {
    const settingsForm = document.getElementById('settingsForm');
    if (!settingsForm) return;

    const recipientInput = document.getElementById('settingsRecipient');
    const smtpServerInput = document.getElementById('settingsSmtpServer');
    const smtpPortInput = document.getElementById('settingsSmtpPort');
    const smtpUserInput = document.getElementById('settingsSmtpUser');
    const smtpPasswordInput = document.getElementById('settingsSmtpPassword');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // Load initial settings
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const settings = await res.json();
            if (settings) {
                recipientInput.value = settings.recipient_email || '';
                smtpServerInput.value = settings.smtp_server || '';
                smtpPortInput.value = settings.smtp_port || '';
                smtpUserInput.value = settings.smtp_user || '';
                // Keep password placeholder, don't prefill plaintext password for security
                if (settings.smtp_password) {
                    smtpPasswordInput.placeholder = '•••••••• (Saved)';
                }
            }
        }
    } catch (err) {
        console.error('Error fetching settings:', err);
    }

    // Save settings
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveSettingsBtn.disabled = true;
        const originalBtnHtml = saveSettingsBtn.innerHTML;
        saveSettingsBtn.innerHTML = 'Saving...';

        const payload = {
            recipient_email: recipientInput.value.trim(),
            smtp_server: smtpServerInput.value.trim(),
            smtp_port: smtpPortInput.value.trim(),
            smtp_user: smtpUserInput.value.trim(),
            smtp_password: smtpPasswordInput.value
        };

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || 'Settings saved successfully!', 'success');
                if (payload.smtp_password) {
                    smtpPasswordInput.value = '';
                    smtpPasswordInput.placeholder = '•••••••• (Saved)';
                }
            } else {
                showToast(data.message || 'Failed to save settings', 'error');
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            showToast('Network error saving settings', 'error');
        } finally {
            saveSettingsBtn.disabled = false;
            saveSettingsBtn.innerHTML = originalBtnHtml;
        }
    });
}


// ============================================================
// ── Billing & Return System Frontend Logic ──────────────────
// ============================================================

// DOM References
const navStockBtn = document.getElementById('navStockBtn');
const navBillingBtn = document.getElementById('navBillingBtn');
const stockDashboardView = document.getElementById('stockDashboardView');
const billingHistoryView = document.getElementById('billingHistoryView');

const searchBillInput = document.getElementById('searchBillInput');
const filterBillStatus = document.getElementById('filterBillStatus');
const btnRefreshBills = document.getElementById('btnRefreshBills');
const billsTableBody = document.getElementById('billsTableBody');

const billDetailsModal = document.getElementById('billDetailsModal');
const closeBillDetailsModal = document.getElementById('closeBillDetailsModal');
const btnDismissBillDetails = document.getElementById('btnDismissBillDetails');
const detailsBillNo = document.getElementById('detailsBillNo');
const detailsBillDate = document.getElementById('detailsBillDate');
const detailsBillCustomer = document.getElementById('detailsBillCustomer');
const detailsBillStatus = document.getElementById('detailsBillStatus');
const detailsItemsBody = document.getElementById('detailsItemsBody');
const detailsBillTotal = document.getElementById('detailsBillTotal');
const detailsBillDiscount = document.getElementById('detailsBillDiscount');
const detailsBillNet = document.getElementById('detailsBillNet');
const detailsLogsSection = document.getElementById('detailsLogsSection');
const detailsLogsBody = document.getElementById('detailsLogsBody');

const returnWizardModal = document.getElementById('returnWizardModal');
const closeReturnWizardModal = document.getElementById('closeReturnWizardModal');
const btnCancelReturnWizard = document.getElementById('btnCancelReturnWizard');
const btnSubmitReturnWizard = document.getElementById('btnSubmitReturnWizard');
const wizardItemName = document.getElementById('wizardItemName');
const wizardItemPurchased = document.getElementById('wizardItemPurchased');
const wizardItemReturned = document.getElementById('wizardItemReturned');
const wizardItemPrice = document.getElementById('wizardItemPrice');
const wizardReturnQty = document.getElementById('wizardReturnQty');
const wizardExchangeFields = document.getElementById('wizardExchangeFields');
const wizardExchangeProductSelect = document.getElementById('wizardExchangeProductSelect');
const wizardExchangeQty = document.getElementById('wizardExchangeQty');
const wizardExchangeUnitPrice = document.getElementById('wizardExchangeUnitPrice');
const wizardExchangeDifference = document.getElementById('wizardExchangeDifference');

let activeWizardBillNo = '';
let activeWizardSku = '';
let activeWizardItem = null;
let activeWizardBill = null;
let allBills = [];

function initBillingHistoryFeature() {
    if (!navStockBtn || !navBillingBtn) return;
    
    // View switching
    navStockBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navStockBtn.classList.add('active');
        navBillingBtn.classList.remove('active');
        stockDashboardView.style.display = 'block';
        billingHistoryView.style.display = 'none';
    });
    
    navBillingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navBillingBtn.classList.add('active');
        navStockBtn.classList.remove('active');
        stockDashboardView.style.display = 'none';
        billingHistoryView.style.display = 'block';
        fetchBillingHistory();
    });
    
    // Filters & Refresh
    if (btnRefreshBills) {
        btnRefreshBills.addEventListener('click', fetchBillingHistory);
    }
    if (searchBillInput) {
        searchBillInput.addEventListener('input', renderBillsList);
    }
    if (filterBillStatus) {
        filterBillStatus.addEventListener('change', renderBillsList);
    }
    
    // Details modal close
    if (closeBillDetailsModal) {
        closeBillDetailsModal.addEventListener('click', () => closeModal(billDetailsModal));
    }
    if (btnDismissBillDetails) {
        btnDismissBillDetails.addEventListener('click', () => closeModal(billDetailsModal));
    }
    
    // Return wizard close
    if (closeReturnWizardModal) {
        closeReturnWizardModal.addEventListener('click', () => closeModal(returnWizardModal));
    }
    if (btnCancelReturnWizard) {
        btnCancelReturnWizard.addEventListener('click', () => closeModal(returnWizardModal));
    }
    
    // Action radio change (Refund vs Exchange)
    document.querySelectorAll('input[name="wizardActionType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'exchange') {
                wizardExchangeFields.style.display = 'block';
                populateExchangeProducts();
            } else {
                wizardExchangeFields.style.display = 'none';
            }
        });
    });
    
    // Exchange product & quantity changes
    if (wizardExchangeProductSelect) {
        wizardExchangeProductSelect.addEventListener('change', calculateExchangeDifference);
    }
    if (wizardExchangeQty) {
        wizardExchangeQty.addEventListener('input', calculateExchangeDifference);
    }
    if (wizardReturnQty) {
        wizardReturnQty.addEventListener('input', calculateExchangeDifference);
    }
    
    // Submit return
    if (btnSubmitReturnWizard) {
        btnSubmitReturnWizard.addEventListener('click', submitReturnWizard);
    }

    // Hash checking on load
    if (window.location.hash === '#billing') {
        navBillingBtn.classList.add('active');
        navStockBtn.classList.remove('active');
        stockDashboardView.style.display = 'none';
        billingHistoryView.style.display = 'block';
        fetchBillingHistory();
    } else {
        navStockBtn.classList.add('active');
        navBillingBtn.classList.remove('active');
        stockDashboardView.style.display = 'block';
        billingHistoryView.style.display = 'none';
    }

    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#billing') {
            navBillingBtn.classList.add('active');
            navStockBtn.classList.remove('active');
            stockDashboardView.style.display = 'none';
            billingHistoryView.style.display = 'block';
            fetchBillingHistory();
        } else if (window.location.hash === '#stock' || window.location.hash === '') {
            navStockBtn.classList.add('active');
            navBillingBtn.classList.remove('active');
            stockDashboardView.style.display = 'block';
            billingHistoryView.style.display = 'none';
        }
    });
}

async function fetchBillingHistory() {
    try {
        const res = await fetch(`${BASE_URL}/api/billing/history`);
        if (res.ok) {
            allBills = await res.json();
            renderBillsList();
        } else {
            showToast('Failed to load billing history', 'error');
        }
    } catch (err) {
        console.error('Error fetching billing history:', err);
        showToast('Network error loading history', 'error');
    }
}

function renderBillsList() {
    if (!billsTableBody) return;
    billsTableBody.innerHTML = '';
    
    const query = searchBillInput.value.toLowerCase().trim();
    const statusFilter = filterBillStatus.value;
    
    const filtered = allBills.filter(bill => {
        const matchesQuery = (bill.bill_no || '').toLowerCase().includes(query) || 
                             (bill.customer_email || '').toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
        return matchesQuery && matchesStatus;
    });
    
    if (filtered.length === 0) {
        billsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-tertiary);">No transactions found</td></tr>`;
        return;
    }
    
    filtered.forEach(bill => {
        const tr = document.createElement('tr');
        
        let statusBadge = '';
        if (bill.status === 'completed') {
            statusBadge = '<span class="status-badge status-completed">Completed</span>';
        } else if (bill.status === 'partially_refunded') {
            statusBadge = '<span class="status-badge status-partially_refunded">Partially Returned</span>';
        } else if (bill.status === 'exchanged') {
            statusBadge = '<span class="status-badge" style="background: rgba(79, 70, 229, 0.15); color: #818cf8; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600;">Exchanged</span>';
        } else {
            statusBadge = '<span class="status-badge status-refunded">Refunded</span>';
        }
        
        tr.innerHTML = `
            <td style="font-weight: 700;">${bill.bill_no}</td>
            <td>${bill.date}</td>
            <td>${bill.customer_email || '<span style="color:#aaa;">Walk-in</span>'}</td>
            <td style="text-align: right; font-weight: 600;">$${parseFloat(bill.total_amount).toFixed(2)}</td>
            <td style="text-align: right; color: var(--accent-red); font-weight: 600;">$${parseFloat(bill.discount_share || bill.discount_value || 0).toFixed(2)}</td>
            <td style="text-align: right; font-weight: 700; color: var(--primary);">$${parseFloat(bill.net_amount).toFixed(2)}</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="text-align: center; display: flex; justify-content: center; gap: 0.4rem; align-items: center;">
                <button class="btn btn-outline" style="padding: 0.25rem 0.4rem; font-size: 0.8rem;" onclick="openBillDetails('${bill.bill_no}')">Details</button>
                <button class="btn btn-primary" style="padding: 0.25rem 0.4rem; font-size: 0.8rem;" onclick="downloadBillPDF('${bill.bill_no}')">PDF</button>
                <button class="btn btn-success" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; background: var(--success); border-color: var(--success); color: white;" onclick="printBillDirect('${bill.bill_no}')">Print</button>
            </td>
        `;
        billsTableBody.appendChild(tr);
    });
}

async function openBillDetails(billNo) {
    try {
        const res = await fetch(`${BASE_URL}/api/billing/details/${billNo}`);
        if (!res.ok) {
            showToast('Failed to fetch transaction details', 'error');
            return;
        }
        const data = await res.json();
        const bill = data.bill;
        const items = data.items;
        const logs = data.logs;
        
        activeWizardBill = bill;
        
        detailsBillNo.textContent = bill.bill_no;
        detailsBillDate.textContent = bill.date;
        detailsBillCustomer.textContent = bill.customer_email || 'Walk-in Customer';
        
        let statusText = '';
        if (bill.status === 'completed') {
            statusText = '<span style="color: var(--success);">COMPLETED</span>';
        } else if (bill.status === 'partially_refunded') {
            statusText = '<span style="color: var(--warning);">PARTIALLY RETURNED</span>';
        } else if (bill.status === 'exchanged') {
            statusText = '<span style="color: #818cf8; font-weight: 700;">EXCHANGED</span>';
        } else {
            statusText = '<span style="color: var(--danger);">FULLY REFUNDED</span>';
        }
        detailsBillStatus.innerHTML = statusText;
        
        // Sum total discount
        let discTotal = 0.0;
        items.forEach(it => {
            discTotal += parseFloat(it.discount_share || 0) * parseInt(it.quantity);
        });
        
        detailsBillTotal.textContent = `$${parseFloat(bill.total_amount).toFixed(2)}`;
        detailsBillDiscount.textContent = `-$${parseFloat(discTotal || bill.discount_value || 0).toFixed(2)}`;
        detailsBillNet.textContent = `$${parseFloat(bill.net_amount).toFixed(2)}`;
        
        // Populate items body
        detailsItemsBody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            
            const purchased = parseInt(item.quantity);
            const returned = parseInt(item.returned_quantity || 0);
            const isExchanged = item.product_name.startsWith('EXCHANGE:');
            const isRefundable = returned < purchased && bill.status !== 'refunded' && !isExchanged;
            
            let actionBtn = '';
            if (isRefundable) {
                actionBtn = `<button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-color: var(--warning); color: var(--warning);" onclick="openReturnWizard('${bill.bill_no}', '${item.sku}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Return / Swap</button>`;
            } else if (isExchanged) {
                actionBtn = `<span style="font-size: 0.8rem; color:#888; font-style: italic; font-weight: 500;">Exchanged Item (Non-Refundable)</span>`;
            } else {
                actionBtn = `<span style="font-size: 0.8rem; color:#aaa;">No Action</span>`;
            }
            
            tr.innerHTML = `
                <td style="padding: 0.75rem; font-weight: 600;">${item.product_name}</td>
                <td style="padding: 0.75rem;"><code class="sku-mono">${item.sku}</code></td>
                <td style="padding: 0.75rem; text-align: right;">$${parseFloat(item.final_sold_price).toFixed(2)}</td>
                <td style="padding: 0.75rem; text-align: center;">${purchased}</td>
                <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: ${returned > 0 ? 'var(--accent-red)' : '#888'};">${returned}</td>
                <td style="padding: 0.75rem; text-align: center;">${actionBtn}</td>
            `;
            detailsItemsBody.appendChild(tr);
        });
        
        // Populate logs section
        if (logs && logs.length > 0) {
            detailsLogsSection.style.display = 'block';
            detailsLogsBody.innerHTML = '';
            logs.forEach(log => {
                const div = document.createElement('div');
                div.style.marginBottom = '0.5rem';
                div.style.borderBottom = '1px dashed rgba(0,0,0,0.05)';
                div.style.paddingBottom = '0.25rem';
                
                const itemsStr = log.items_involved.map(it => `${it.action === 'refunded' ? 'Returned' : 'Issued'} ${it.quantity}x ${it.product_name} (${it.sku})`).join(', ');
                const cashStr = parseFloat(log.cash_delta) < 0 
                    ? `Refunded $${Math.abs(parseFloat(log.cash_delta)).toFixed(2)} cash` 
                    : (parseFloat(log.cash_delta) > 0 ? `Charged additional $${parseFloat(log.cash_delta).toFixed(2)}` : 'No cash adjustment');
                    
                div.innerHTML = `<strong>[${log.date}] ${log.type.toUpperCase()}:</strong> ${itemsStr}. <em>${cashStr}</em>`;
                detailsLogsBody.appendChild(div);
            });
        } else {
            detailsLogsSection.style.display = 'none';
        }
        
        openModal(billDetailsModal);
    } catch (err) {
        console.error('Error opening bill details:', err);
        showToast('Error opening transaction details', 'error');
    }
}

function openReturnWizard(billNo, sku, itemJson) {
    activeWizardBillNo = billNo;
    activeWizardSku = sku;
    activeWizardItem = itemJson;
    
    wizardItemName.textContent = activeWizardItem.product_name;
    wizardItemPurchased.textContent = activeWizardItem.quantity;
    wizardItemReturned.textContent = activeWizardItem.returned_quantity || 0;
    wizardItemPrice.textContent = `$${parseFloat(activeWizardItem.final_sold_price).toFixed(2)}`;
    
    // Reset inputs
    wizardReturnQty.value = 1;
    wizardReturnQty.max = parseInt(activeWizardItem.quantity) - parseInt(activeWizardItem.returned_quantity || 0);
    document.querySelector('input[name="wizardActionType"][value="refund"]').checked = true;
    wizardExchangeFields.style.display = 'none';
    
    openModal(returnWizardModal);
}

function populateExchangeProducts() {
    if (!wizardExchangeProductSelect) return;
    wizardExchangeProductSelect.innerHTML = '';
    
    // Sort inventory alphabetically
    const sorted = [...inventory].sort((a,b) => a.name.localeCompare(b.name));
    
    sorted.forEach(prod => {
        if (prod.sku === activeWizardSku) return; // Don't exchange for itself
        const opt = document.createElement('option');
        opt.value = prod.sku;
        opt.textContent = `${prod.name} (${prod.sku}) - $${parseFloat(prod.selling_price).toFixed(2)} [Stock: ${prod.quantity}]`;
        wizardExchangeProductSelect.appendChild(opt);
    });
    
    calculateExchangeDifference();
}

function calculateExchangeDifference() {
    const radio = document.querySelector('input[name="wizardActionType"]:checked');
    if (!radio || radio.value !== 'exchange') return;
    
    const retQty = parseInt(wizardReturnQty.value || 0);
    const exchQty = parseInt(wizardExchangeQty.value || 0);
    const exchSku = wizardExchangeProductSelect.value;
    
    const exchProd = inventory.find(p => p.sku === exchSku);
    if (!exchProd) return;
    
    const exchPrice = parseFloat(exchProd.selling_price);
    wizardExchangeUnitPrice.textContent = `$${exchPrice.toFixed(2)}`;
    
    const valueReturned = parseFloat(activeWizardItem.final_sold_price) * retQty;
    const valueIssued = exchPrice * exchQty;
    const difference = valueIssued - valueReturned;
    
    if (difference > 0) {
        wizardExchangeDifference.textContent = `Customer pays difference: +$${difference.toFixed(2)}`;
        wizardExchangeDifference.style.color = 'var(--accent-red)';
    } else if (difference < 0) {
        wizardExchangeDifference.textContent = `Refund difference to customer: -$${Math.abs(difference).toFixed(2)}`;
        wizardExchangeDifference.style.color = 'var(--success)';
    } else {
        wizardExchangeDifference.textContent = `Even Swap: $0.00`;
        wizardExchangeDifference.style.color = 'var(--text-primary)';
    }
}

async function submitReturnWizard() {
    const actionType = document.querySelector('input[name="wizardActionType"]:checked').value;
    const returnQty = parseInt(wizardReturnQty.value || 0);
    
    if (returnQty <= 0) {
        showToast('Please enter a valid return quantity', 'error');
        return;
    }
    
    const maxRefundable = parseInt(activeWizardItem.quantity) - parseInt(activeWizardItem.returned_quantity || 0);
    if (maxRefundable <= 0) {
        showToast('This item has already been fully returned or exchanged', 'error');
        return;
    }
    if (returnQty > maxRefundable) {
        showToast(`Cannot return more than ${maxRefundable} units`, 'error');
        return;
    }
    
    btnSubmitReturnWizard.disabled = true;
    const originalText = btnSubmitReturnWizard.textContent;
    btnSubmitReturnWizard.textContent = 'Processing...';
    
    try {
        if (actionType === 'refund') {
            const res = await fetch(`${BASE_URL}/api/billing/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bill_no: activeWizardBillNo,
                    sku: activeWizardSku,
                    bill_item_id: activeWizardItem.id,
                    quantity: returnQty
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Refund processed successfully!', 'success');
                closeModal(returnWizardModal);
                openBillDetails(activeWizardBillNo); // Re-open and refresh details modal
                
                // Sync local state
                inventory = data.inventory || inventory;
                renderInventory();
                fetchBillingHistory();
            } else {
                showToast(data.error || 'Failed to process refund', 'error');
            }
        } else {
            // Exchange
            const exchSku = wizardExchangeProductSelect.value;
            const exchQty = parseInt(wizardExchangeQty.value || 0);
            
            if (!exchSku || exchQty <= 0) {
                showToast('Please select a valid exchange product & quantity', 'error');
                btnSubmitReturnWizard.disabled = false;
                btnSubmitReturnWizard.textContent = originalText;
                return;
            }
            
            const exchProd = inventory.find(p => p.sku === exchSku);
            if (exchProd.quantity < exchQty) {
                showToast(`Insufficient stock of replacement item. Available: ${exchProd.quantity}`, 'error');
                btnSubmitReturnWizard.disabled = false;
                btnSubmitReturnWizard.textContent = originalText;
                return;
            }
            
            const res = await fetch(`${BASE_URL}/api/billing/exchange`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bill_no: activeWizardBillNo,
                    returned_sku: activeWizardSku,
                    bill_item_id: activeWizardItem.id,
                    returned_quantity: returnQty,
                    exchanged_sku: exchSku,
                    exchanged_quantity: exchQty
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Exchange processed successfully!', 'success');
                closeModal(returnWizardModal);
                openBillDetails(activeWizardBillNo); // Re-open and refresh details modal
                
                // Sync local state
                inventory = data.inventory || inventory;
                renderInventory();
                fetchBillingHistory();
            } else {
                showToast(data.error || 'Failed to process exchange', 'error');
            }
        }
    } catch (err) {
        console.error('Error processing return transaction:', err);
        showToast('Network error processing transaction', 'error');
    } finally {
        btnSubmitReturnWizard.disabled = false;
        btnSubmitReturnWizard.textContent = originalText;
    }
}

// Bind to window for dynamic element calls
window.openBillDetails = openBillDetails;
window.openReturnWizard = openReturnWizard;

// Clear analytics button handler
const btnClearAnalyticsBtn = document.getElementById('btnClearAnalyticsBtn');
if (btnClearAnalyticsBtn) {
    btnClearAnalyticsBtn.addEventListener('click', async () => {
        const confirmed = confirm("⚠️ WARNING: This will permanently delete all sales history, bills, line items, and transaction logs. This action cannot be undone.\n\nAre you sure you want to clear all business analytics?");
        if (!confirmed) return;
        
        const doubleCheck = confirm("Double Check: Are you absolutely sure? All data will be deleted permanently.");
        if (!doubleCheck) return;
        
        btnClearAnalyticsBtn.disabled = true;
        const originalText = btnClearAnalyticsBtn.textContent;
        btnClearAnalyticsBtn.textContent = 'Clearing Data...';
        
        try {
            const res = await fetch(`${BASE_URL}/api/analytics/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Analytics and transaction logs cleared successfully!', 'success');
                // Refresh billing history if currently viewed
                if (billingHistoryView && billingHistoryView.style.display === 'block') {
                    fetchBillingHistory();
                }
                // Refresh sales metrics on dashboard
                fetchSalesSummary();
            } else {
                showToast(data.error || 'Failed to clear analytics', 'error');
            }
        } catch (err) {
            console.error('Error clearing analytics:', err);
            showToast('Network error clearing analytics', 'error');
        } finally {
            btnClearAnalyticsBtn.disabled = false;
            btnClearAnalyticsBtn.textContent = originalText;
        }
    });
}

async function downloadBillPDF(billNo) {
    try {
        showToast('Preparing download...', 'info');
        const res = await fetch(`${BASE_URL}/api/billing/pdf/${billNo}`);
        if (!res.ok) {
            if (res.status === 401) {
                showToast('Session expired, please login again', 'error');
            } else {
                showToast('Failed to download PDF', 'error');
            }
            return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${billNo}_Receipt.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('PDF downloaded successfully!');
    } catch (err) {
        console.error('Error downloading PDF:', err);
        showToast('Network error downloading PDF', 'error');
    }
}

async function printBillDirect(billNo) {
    try {
        showToast('Loading print document...', 'info');
        const res = await fetch(`${BASE_URL}/api/billing/pdf/${billNo}`);
        if (!res.ok) {
            showToast('Failed to load PDF for printing', 'error');
            return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        
        let iframe = document.getElementById('pdfPrintIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'pdfPrintIframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
        }
        iframe.src = url;
        iframe.onload = function() {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error('Error printing PDF via iframe:', err);
                showToast('Failed to trigger print dialog', 'error');
            }
        };
    } catch (err) {
        console.error('Error printing PDF:', err);
        showToast('Network error preparing print', 'error');
    }
}

function printBillFromModal() {
    const billNo = detailsBillNo.textContent.trim();
    if (billNo && billNo !== '—') {
        printBillDirect(billNo);
    } else {
        showToast('No active bill selected', 'error');
    }
}

window.downloadBillPDF = downloadBillPDF;
window.printBillDirect = printBillDirect;
window.printBillFromModal = printBillFromModal;
