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
let html5QrcodeScanner = null;
let currentEditingSku = null;
let currentFilter = 'all';
let skuToDelete = '';
let activeMode = 'intake'; // 'intake' or 'bill'
let categories = ['General'];
let activeScanCategory = 'All';


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

    qtyImageUrl.addEventListener('input', () => {
        const url = qtyImageUrl.value.trim();
        activeScanImage = url;
        updateQtyPreviewImage(url);
    });

    // Fuzzy
    createAsNewBtn.addEventListener('click', () => { closeModal(fuzzyModal); openQtyModal(activeScanName, activeScanBarcode, activeScanSku); });
    cancelFuzzyBtn.addEventListener('click', () => closeModal(fuzzyModal));

    // Register
    cancelRegisterBtn.addEventListener('click', () => closeModal(registerModal));
    confirmRegisterBtn.addEventListener('click', submitRegistration);

    // Edit
    cancelEditBtn.addEventListener('click', () => closeModal(editModal));
    confirmEditBtn.addEventListener('click', submitEditUpdate);

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

        const imgHtml = item.image_url
            ? `<img src="${item.image_url}" class="prod-img" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\\'prod-img-placeholder\\'>📦</div>';">`
            : `<div class="prod-img-placeholder">📦</div>`;

        const escapedName = item.name.replace(/'/g, "\\'");
        
        const intakePriceText = item.intake_price > 0 ? `Rs. ${item.intake_price.toFixed(2)}` : '—';
        const avgSellingPriceText = item.avg_selling_price > 0 ? `Rs. ${item.avg_selling_price.toFixed(2)}` : '—';

        row.innerHTML = `
            <td>
                <div class="prod-cell">
                    ${imgHtml}
                    <div style="display:flex; flex-direction:column; gap:0.25rem;">
                        <span class="prod-name">${item.name}</span>
                        <span class="category-badge" style="font-size: 0.7rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.15rem 0.4rem; border-radius: 4px; align-self: flex-start; text-transform: uppercase;">${item.category || 'General'}</span>
                    </div>
                </div>
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:0.25rem;">
                    <span class="sku-mono">${item.sku}</span>
                    <span class="barcode-mono">${item.barcode}</span>
                </div>
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:0.25rem;">
                    <span class="text-muted">In: ${intakePriceText}</span>
                    <span class="text-green" style="font-weight: 600;">Out: ${avgSellingPriceText}</span>
                </div>
            </td>
            <td><span class="stock-badge ${badgeClass}">${badgeText}</span></td>
            <td class="text-right">
                <div class="action-cell">
                    <button class="btn btn-sm btn-outline text-green" style="border-color: var(--success);" onclick="addToCart('${item.sku}')">Bill</button>
                    <button class="btn btn-sm btn-ghost" onclick="openEditModal('${item.sku}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDelete('${item.sku}', '${escapedName}')">Delete</button>
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
            activeScanSku = '';
            openFuzzyModal(data.web_name, data.similar);
        } else if (data.status === 'new_web_match') {
            addLog(`Resolved: "${data.web_name}"`, 'success');
            activeScanName = data.web_name;
            activeScanImage = data.image_url || '';
            activeScanSku = data.sku;
            openQtyModal(data.web_name, barcode, data.sku, data.image_url);
        } else {
            addLog(`Barcode "${barcode}" not recognized.`, 'warning');
            activeScanImage = '';
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
function openQtyModal(name, barcode, sku, image_url = '') {
    qtyModalProdName.textContent = name;
    qtyModalBarcode.textContent = barcode;
    qtyInput.value = '1';
    activeScanName = name;
    activeScanBarcode = barcode;
    activeScanSku = sku;
    activeScanImage = image_url;
    qtyImageUrl.value = image_url || '';
    
    // Look up if product already exists to prefill details
    const existing = inventory.find(p => p.sku === sku || p.barcode === barcode);
    qtyIntakePrice.value = (existing && existing.intake_price) ? existing.intake_price : '';
    qtySellingPrice.value = (existing && existing.selling_price) ? existing.selling_price : '';
    qtyCategory.value = (existing && existing.category) ? existing.category : activeScanCategory;
    
    updateQtyPreviewImage(image_url);
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
    
    const payload = {
        barcode: activeScanBarcode,
        sku: activeScanSku,
        name: activeScanName,
        quantity: qty,
        image_url: qtyImageUrl.value.trim() || activeScanImage,
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
            openQtyModal(prod.name, activeScanBarcode, prod.sku, prod.image_url || activeScanImage);
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
    
    const payload = {
        barcode: activeScanBarcode,
        sku,
        name,
        quantity: qty,
        image_url: registerImage.value.trim(),
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
    editImage.value = item.image_url || '';
    editIntakePrice.value = item.intake_price || '';
    editSellingPrice.value = item.selling_price || '';
    editCategory.value = item.category || 'General';
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

    try {
        const res = await fetch(`${BASE_URL}/api/inventory/edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku: currentEditingSku,
                barcode: editBarcode.value.trim(),
                name,
                quantity: qty,
                image_url: editImage.value.trim(),
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
        if (!res.ok) throw new Error('Delete failed');
        const data = await res.json();
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
        showToast('Delete failed', 'error');
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
            const imageUrl = manualProdImage.value.trim();

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
                image_url: imageUrl
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

        if (prod.image_url) {
            const imgEl = document.createElement('img');
            imgEl.src = prod.image_url;
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

