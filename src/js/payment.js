// Payment processing module
import { ref, push, set, get, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { shopDB, storage, generateOrderId, sanitizeInput, validatePhone, normalizePhone, handleFirebaseError, checkRateLimit } from './firebase.js';
import configManager from './config.js';
import authManager from './auth.js';
import i18n from './i18n.js';

class PaymentManager {
  constructor() {
    this.selectedPaymentMethod = null;
    this.currentOrder = null;
    this.proofFile = null;
    this.init();
  }

  init() {
    this.setupPaymentUI();
    this.setupProofUploadUI();
    
    // Listen for config updates
    window.addEventListener('paymentMethodsUpdated', () => {
      this.updatePaymentMethodsDisplay();
    });
  }

  setupPaymentUI() {
    // Payment methods will be loaded when captcha is verified
    this.updatePaymentMethodsDisplay();
  }

  async updatePaymentMethodsDisplay() {
    const paymentMethodsContainer = document.getElementById('paymentMethods');
    if (!paymentMethodsContainer) return;

    const methods = configManager.getPaymentMethods();
    
    if (Object.keys(methods).length === 0) {
      paymentMethodsContainer.innerHTML = `
        <div class="text-center text-gray-400 py-8">
          <p>No payment methods available. Please contact admin.</p>
        </div>
      `;
      return;
    }

    paymentMethodsContainer.innerHTML = '';
    
    Object.entries(methods).forEach(([key, method]) => {
      const methodCard = this.createPaymentMethodCard(key, method);
      paymentMethodsContainer.appendChild(methodCard);
    });
  }

  createPaymentMethodCard(key, method) {
    const card = document.createElement('div');
    card.className = 'payment-method-card';
    card.dataset.method = key;
    
    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-3">
          <div class="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
            </svg>
          </div>
          <div>
            <h4 class="font-semibold text-lg">${method.providerLabel}</h4>
            <p class="text-sm text-gray-400">${method.accountName}</p>
          </div>
        </div>
        <input type="radio" name="paymentMethod" value="${key}" class="w-5 h-5 text-emerald-600">
      </div>
      
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-400">${i18n.t('payment.accountNumber')}:</span>
          <div class="flex items-center space-x-2">
            <span class="font-mono font-semibold">${method.accountNumber}</span>
            <button type="button" class="copy-account-btn text-emerald-400 hover:text-emerald-300 text-sm" 
                    data-account="${method.accountNumber}">
              ${i18n.t('payment.copyAccount')}
            </button>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-400">${i18n.t('payment.accountName')}:</span>
          <span class="font-semibold">${method.accountName}</span>
        </div>
      </div>
      
      ${method.qrImageUrl ? `
        <div class="mt-4 text-center">
          <img src="${method.qrImageUrl}" alt="QR Code" class="max-w-32 mx-auto rounded border">
        </div>
      ` : ''}
      
      <div class="mt-4 p-3 bg-gray-600/50 rounded text-sm">
        <p class="text-gray-300">${method.instructions}</p>
      </div>
    `;

    // Add event listeners
    const radio = card.querySelector('input[type="radio"]');
    const copyBtn = card.querySelector('.copy-account-btn');

    radio?.addEventListener('change', () => {
      if (radio.checked) {
        this.selectPaymentMethod(key, method);
      }
    });

    copyBtn?.addEventListener('click', () => {
      this.copyToClipboard(method.accountNumber);
    });

    card.addEventListener('click', (e) => {
      if (e.target.type !== 'radio' && e.target.type !== 'button') {
        radio.checked = true;
        this.selectPaymentMethod(key, method);
      }
    });

    return card;
  }

  selectPaymentMethod(key, method) {
    this.selectedPaymentMethod = { key, ...method };
    
    // Update UI
    const cards = document.querySelectorAll('.payment-method-card');
    cards.forEach(card => {
      if (card.dataset.method === key) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    // Update submit button
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.textContent = i18n.t('payment.confirmPayment');
      submitBtn.removeAttribute('disabled');
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showMessage('success', i18n.t('payment.copied'));
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showMessage('success', i18n.t('payment.copied'));
    }
  }

  async createOrder(formData) {
    try {
      // Validate user is authenticated
      if (!authManager.isAuthenticated()) {
        throw new Error('Please login to place an order');
      }

      // Rate limiting check
      const user = authManager.getCurrentUser();
      if (!checkRateLimit(`order:${user.uid}`, 5, 300000)) { // 5 orders per 5 minutes
        throw new Error('Too many orders. Please wait before placing another order.');
      }

      // Validate form data
      const validatedData = await this.validateOrderData(formData);
      
      // Generate order ID
      const orderId = generateOrderId();
      
      // Create order object
      const orderData = {
        orderId,
        buyerUID: user.uid,
        buyerEmail: user.email,
        category: validatedData.category,
        purchaseType: validatedData.purchaseType,
        itemKey: validatedData.itemKey || null,
        world: validatedData.world,
        growId: validatedData.growId,
        customerName: validatedData.customerName,
        whatsappNumber: validatedData.whatsappNumber,
        quantity: validatedData.quantity,
        unitPrice: validatedData.unitPrice,
        totalPrice: validatedData.totalPrice,
        paymentMethod: this.selectedPaymentMethod.key,
        paymentTarget: {
          provider: this.selectedPaymentMethod.providerLabel,
          accountNumber: this.selectedPaymentMethod.accountNumber,
          accountName: this.selectedPaymentMethod.accountName
        },
        notes: validatedData.notes || '',
        captchaToken: validatedData.captchaToken,
        timestamp: new Date().toISOString(),
        status: 'pending_confirmation',
        statusHistory: [{
          status: 'pending_confirmation',
          timestamp: new Date().toISOString(),
          note: 'Order created'
        }]
      };

      // Save order to database
      const orderRef = ref(shopDB, `orders/${orderId}`);
      await set(orderRef, orderData);
      
      // Store order reference in user's auth database
      await this.createUserOrderReference(user.uid, orderId, orderData);
      
      this.currentOrder = orderData;
      
      return { success: true, orderId, orderData };
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  async createUserOrderReference(userUID, orderId, orderData) {
    try {
      // Import auth database reference
      const { ref: authRef, set: authSet } = await import('firebase/database');
      const { authDB } = await import('./firebase.js');
      
      // Create minimal reference in user's profile
      const userOrderRef = authRef(authDB, `users/${userUID}/orders/${orderId}`);
      await authSet(userOrderRef, {
        orderId,
        category: orderData.category,
        totalPrice: orderData.totalPrice,
        timestamp: orderData.timestamp,
        status: orderData.status
      });
    } catch (error) {
      console.warn('Could not create user order reference:', error);
      // Non-critical error, don't throw
    }
  }

  async validateOrderData(formData) {
    const errors = [];

    // Basic validation
    if (!formData.world || formData.world.length > 30) {
      errors.push('World name is required and must be under 30 characters');
    }

    if (!formData.growId || formData.growId.length > 30) {
      errors.push('GrowID is required and must be under 30 characters');
    }

    if (!formData.customerName || formData.customerName.length > 50) {
      errors.push('Customer name is required and must be under 50 characters');
    }

    if (!formData.whatsappNumber) {
      errors.push('WhatsApp number is required');
    }

    if (!formData.category) {
      errors.push('Category is required');
    }

    if (!formData.quantity || formData.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    // Sanitize inputs
    const sanitized = {
      world: sanitizeInput(formData.world),
      growId: sanitizeInput(formData.growId),
      customerName: sanitizeInput(formData.customerName),
      whatsappNumber: normalizePhone(formData.whatsappNumber),
      category: formData.category.toUpperCase(),
      purchaseType: formData.purchaseType,
      itemKey: formData.itemKey,
      quantity: parseInt(formData.quantity),
      notes: sanitizeInput(formData.notes || ''),
      captchaToken: formData.captchaToken
    };

    // Validate phone number
    if (!validatePhone(sanitized.whatsappNumber)) {
      throw new Error('Invalid WhatsApp number format');
    }

    // Validate quantity limits
    const maxQuantity = configManager.getMaxQuantity(sanitized.category.toLowerCase());
    if (sanitized.quantity > maxQuantity) {
      throw new Error(`Maximum quantity is ${maxQuantity}`);
    }

    // Calculate prices
    if (sanitized.category === 'RGT') {
      sanitized.unitPrice = configManager.getRGTPrice(sanitized.purchaseType);
    } else if (sanitized.category === 'RPS') {
      sanitized.unitPrice = configManager.getRPSPrice(sanitized.itemKey);
    }

    if (!sanitized.unitPrice || sanitized.unitPrice <= 0) {
      throw new Error('Invalid price configuration. Please contact admin.');
    }

    sanitized.totalPrice = configManager.calculateTotal(sanitized.unitPrice, sanitized.quantity);

    return sanitized;
  }

  // Proof Upload Methods
  setupProofUploadUI() {
    const proofModal = document.getElementById('proofModal');
    const dropZone = document.getElementById('dropZone');
    const proofFile = document.getElementById('proofFile');
    const proofForm = document.getElementById('proofForm');
    const cancelProof = document.getElementById('cancelProof');
    const removeImage = document.getElementById('removeImage');

    // File input handler
    proofFile?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileSelection(file);
      }
    });

    // Drop zone handlers
    dropZone?.addEventListener('click', () => {
      proofFile?.click();
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-emerald-500', 'bg-emerald-500/10');
    });

    dropZone?.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-emerald-500', 'bg-emerald-500/10');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-emerald-500', 'bg-emerald-500/10');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelection(files[0]);
      }
    });

    // Form submission
    proofForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.uploadProof();
    });

    // Cancel button
    cancelProof?.addEventListener('click', () => {
      this.hideProofModal();
    });

    // Remove image button
    removeImage?.addEventListener('click', () => {
      this.clearFileSelection();
    });
  }

  handleFileSelection(file) {
    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      this.showMessage('error', 'Please select a valid image file (JPG, PNG, WebP)');
      return;
    }

    if (file.size > maxSize) {
      this.showMessage('error', 'File size must be less than 10MB');
      return;
    }

    this.proofFile = file;
    this.showFilePreview(file);
  }

  showFilePreview(file) {
    const dropZone = document.getElementById('dropZone');
    const imagePreview = document.getElementById('imagePreview');
    const img = imagePreview?.querySelector('img');

    if (!img) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      dropZone?.classList.add('hidden');
      imagePreview?.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  clearFileSelection() {
    this.proofFile = null;
    const dropZone = document.getElementById('dropZone');
    const imagePreview = document.getElementById('imagePreview');
    const proofFileInput = document.getElementById('proofFile');

    dropZone?.classList.remove('hidden');
    imagePreview?.classList.add('hidden');
    if (proofFileInput) proofFileInput.value = '';
  }

  showProofModal() {
    const proofModal = document.getElementById('proofModal');
    proofModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  hideProofModal() {
    const proofModal = document.getElementById('proofModal');
    proofModal?.classList.add('hidden');
    document.body.style.overflow = '';
    this.clearFileSelection();
  }

  async uploadProof() {
    if (!this.proofFile) {
      this.showMessage('error', 'Please select a file first');
      return;
    }

    if (!this.currentOrder) {
      this.showMessage('error', 'No order found. Please create an order first.');
      return;
    }

    try {
      this.showProofUploading(true);

      // Create file reference
      const timestamp = Date.now();
      const filename = `${timestamp}_${this.proofFile.name}`;
      const fileRef = storageRef(storage, `proofs/${this.currentOrder.orderId}/${filename}`);

      // Upload file
      const snapshot = await uploadBytes(fileRef, this.proofFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update order with proof URL
      const orderRef = ref(shopDB, `orders/${this.currentOrder.orderId}`);
      await update(orderRef, {
        proofUrl: downloadURL,
        proofUploadedAt: new Date().toISOString(),
        status: 'awaiting_admin_review',
        statusHistory: [
          ...this.currentOrder.statusHistory,
          {
            status: 'awaiting_admin_review',
            timestamp: new Date().toISOString(),
            note: 'Payment proof uploaded'
          }
        ]
      });

      // Send notification to admin via Cloud Function
      await this.notifyAdmin(this.currentOrder.orderId);

      this.showMessage('success', i18n.t('proof.success'));
      this.hideProofModal();
      
      // Show order status
      this.showOrderStatus();
      
    } catch (error) {
      console.error('Error uploading proof:', error);
      this.showMessage('error', i18n.t('proof.error'));
    } finally {
      this.showProofUploading(false);
    }
  }

  showProofUploading(show) {
    const uploadBtn = document.getElementById('uploadProofBtn');
    
    if (show) {
      uploadBtn?.setAttribute('disabled', 'true');
      if (uploadBtn) uploadBtn.innerHTML = '<div class="loading-dots">Uploading</div>';
    } else {
      uploadBtn?.removeAttribute('disabled');
      if (uploadBtn) uploadBtn.textContent = i18n.t('proof.upload');
    }
  }

  async notifyAdmin(orderId) {
    try {
      // This would call a Cloud Function to send Telegram notification
      const response = await fetch('/api/notify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId,
          action: 'proof_uploaded'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to notify admin');
      }
    } catch (error) {
      console.warn('Could not notify admin:', error);
      // Non-critical error, don't throw
    }
  }

  showOrderStatus() {
    // Show order status page or update UI
    const homeView = document.getElementById('homeView');
    const purchaseView = document.getElementById('purchaseView');
    
    homeView?.classList.remove('hidden');
    purchaseView?.classList.add('hidden');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Show success message with order ID
    this.showMessage('success', `Order ${this.currentOrder.orderId} created successfully! We will notify you once payment is confirmed.`);
  }

  showMessage(type, message) {
    if (window.authManager && typeof window.authManager.showMessage === 'function') {
      window.authManager.showMessage(type, message);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  // Public methods
  getSelectedPaymentMethod() {
    return this.selectedPaymentMethod;
  }

  getCurrentOrder() {
    return this.currentOrder;
  }

  resetPayment() {
    this.selectedPaymentMethod = null;
    this.currentOrder = null;
    this.proofFile = null;
    
    // Reset UI
    const cards = document.querySelectorAll('.payment-method-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    const radios = document.querySelectorAll('input[name="paymentMethod"]');
    radios.forEach(radio => radio.checked = false);
  }
}

// Create global payment instance
const paymentManager = new PaymentManager();

// Export for use in other modules
export default paymentManager;

// Also make it available globally
window.paymentManager = paymentManager;
