// Main application controller
import authManager from './auth.js';
import configManager from './config.js';
import captchaManager from './captcha.js';
import paymentManager from './payment.js';
import customerServiceChat from './chat.js';
import i18n from './i18n.js';

class GrowtopiaShopApp {
  constructor() {
    this.currentCategory = null;
    this.currentView = 'home';
    this.isFormValid = false;
    this.init();
  }

  async init() {
    try {
      // Wait for config to load
      await configManager.waitForLoad();
      
      // Initialize UI components
      this.setupThemeToggle();
      this.setupLanguageToggle();
      this.setupNavigation();
      this.setupFormHandlers();
      this.setupEventListeners();
      
      // Initialize captcha UI
      captchaManager.setupCaptchaUI();
      
      console.log('Growtopia Shop App initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      this.showMessage('error', 'Failed to initialize application. Please refresh the page.');
    }
  }

  setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'dark';
    
    // Set initial theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    themeToggle?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const newTheme = current === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Update theme toggle icon
      this.updateThemeToggleIcon(newTheme);
    });
    
    this.updateThemeToggleIcon(currentTheme);
  }

  updateThemeToggleIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const iconSvg = themeToggle.querySelector('svg path');
    if (!iconSvg) return;
    
    if (theme === 'dark') {
      // Moon icon
      iconSvg.setAttribute('d', 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z');
    } else {
      // Sun icon  
      iconSvg.setAttribute('d', 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z');
    }
  }

  setupLanguageToggle() {
    const languageSelect = document.getElementById('languageSelect');
    
    // Set initial language
    languageSelect.value = i18n.getCurrentLanguage();
    
    languageSelect?.addEventListener('change', (e) => {
      i18n.setLanguage(e.target.value);
    });
    
    // Listen for language changes
    window.addEventListener('languageChanged', () => {
      this.updateFormLabels();
    });
  }

  setupNavigation() {
    const categoryCards = document.querySelectorAll('.category-card');
    const backToHome = document.getElementById('backToHome');
    
    categoryCards.forEach(card => {
      card.addEventListener('click', () => {
        const category = card.getAttribute('data-category');
        this.showPurchaseForm(category);
      });
    });
    
    backToHome?.addEventListener('click', () => {
      this.showHome();
    });
  }

  showHome() {
    const homeView = document.getElementById('homeView');
    const purchaseView = document.getElementById('purchaseView');
    
    homeView?.classList.remove('hidden');
    purchaseView?.classList.add('hidden');
    
    this.currentView = 'home';
    this.currentCategory = null;
    
    // Reset form and payment state
    this.resetForm();
    captchaManager.resetCaptcha();
    paymentManager.resetPayment();
    
    // Update URL without reload
    if (window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
  }

  async showPurchaseForm(category) {
    const homeView = document.getElementById('homeView');
    const purchaseView = document.getElementById('purchaseView');
    const purchaseTitle = document.getElementById('purchaseTitle');
    const purchaseDescription = document.getElementById('purchaseDescription');
    
    homeView?.classList.add('hidden');
    purchaseView?.classList.remove('hidden');
    purchaseView?.classList.add('animate-fade-in');
    
    this.currentView = 'purchase';
    this.currentCategory = category;
    
    // Update form title and description
    if (category === 'rgt') {
      if (purchaseTitle) purchaseTitle.textContent = i18n.t('categories.rgt.title');
      if (purchaseDescription) purchaseDescription.textContent = i18n.t('categories.rgt.description');
    } else if (category === 'rps') {
      if (purchaseTitle) purchaseTitle.textContent = i18n.t('categories.rps.title');
      if (purchaseDescription) purchaseDescription.textContent = i18n.t('categories.rps.description');
    }
    
    // Setup product selection based on category
    await this.setupProductSelection(category);
    
    // Reset form state
    this.resetForm();
    
    // Update URL
    if (window.history.pushState) {
      window.history.pushState({}, '', `/${category}`);
    }
  }

  async setupProductSelection(category) {
    const productSelection = document.getElementById('productSelection');
    if (!productSelection) return;
    
    if (category === 'rgt') {
      productSelection.innerHTML = `
        <div>
          <label class="block text-sm font-medium mb-3" data-i18n="form.purchaseType">Purchase Type</label>
          <div class="space-y-3">
            <label class="flex items-center p-4 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
              <input type="radio" name="purchaseType" value="dl" class="mr-3" checked>
              <div>
                <div class="font-semibold">Diamond Lock</div>
                <div class="text-sm text-gray-400" id="dlPrice">Loading price...</div>
              </div>
            </label>
            <label class="flex items-center p-4 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
              <input type="radio" name="purchaseType" value="bgl" class="mr-3">
              <div>
                <div class="font-semibold">Blue Gem Lock</div>
                <div class="text-sm text-gray-400" id="bglPrice">Loading price...</div>
              </div>
            </label>
          </div>
        </div>
      `;
      
      // Load and display prices
      this.updateRGTPrices();
      
      // Show notes field for RPS only
      const notesField = document.getElementById('specialNotes');
      notesField?.classList.add('hidden');
      
    } else if (category === 'rps') {
      const rpsItems = configManager.getRPSItems();
      
      if (rpsItems.length === 0) {
        productSelection.innerHTML = `
          <div class="text-center text-gray-400 py-8">
            <p>No RPS items available at the moment. Please check back later.</p>
          </div>
        `;
        return;
      }
      
      productSelection.innerHTML = `
        <div>
          <label class="block text-sm font-medium mb-3" data-i18n="form.rpsItem">Select Item</label>
          <div class="space-y-3">
            ${rpsItems.map((item, index) => `
              <label class="flex items-center p-4 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                <input type="radio" name="itemKey" value="${item.key}" class="mr-3" ${index === 0 ? 'checked' : ''}>
                <div class="flex-1">
                  <div class="font-semibold">${item.label_en}</div>
                  <div class="text-sm text-gray-400">${i18n.formatCurrency(item.price)}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      `;
      
      // Show notes field for RPS
      const notesField = document.getElementById('specialNotes');
      notesField?.classList.remove('hidden');
    }
    
    // Add event listeners for product selection
    this.setupProductSelectionListeners();
  }

  updateRGTPrices() {
    const dlPrice = configManager.getRGTPrice('dl');
    const bglPrice = configManager.getRGTPrice('bgl');
    
    const dlPriceEl = document.getElementById('dlPrice');
    const bglPriceEl = document.getElementById('bglPrice');
    
    if (dlPriceEl) dlPriceEl.textContent = i18n.formatCurrency(dlPrice) + ' each';
    if (bglPriceEl) bglPriceEl.textContent = i18n.formatCurrency(bglPrice) + ' each';
  }

  setupProductSelectionListeners() {
    const productRadios = document.querySelectorAll('input[name="purchaseType"], input[name="itemKey"]');
    productRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.calculateTotalPrice();
      });
    });
  }

  setupFormHandlers() {
    const purchaseForm = document.getElementById('purchaseForm');
    const quantityInput = document.getElementById('quantity');
    
    // Form submission
    purchaseForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });
    
    // Quantity change
    quantityInput?.addEventListener('input', () => {
      this.calculateTotalPrice();
      this.validateQuantity();
    });
    
    // Real-time form validation
    this.setupFormValidation();
  }

  setupFormValidation() {
    const inputs = ['world', 'growId', 'customerName', 'whatsappNumber'];
    
    inputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      input?.addEventListener('input', () => {
        this.validateField(input);
        this.updateFormValidity();
      });
      
      input?.addEventListener('blur', () => {
        this.validateField(input);
      });
    });
  }

  validateField(input) {
    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    switch (input.id) {
      case 'world':
        isValid = value.length > 0 && value.length <= 30;
        errorMessage = 'World name must be 1-30 characters';
        break;
      case 'growId':
        isValid = value.length > 0 && value.length <= 30 && /^[a-zA-Z0-9]+$/.test(value);
        errorMessage = 'GrowID must be alphanumeric and 1-30 characters';
        break;
      case 'customerName':
        isValid = value.length > 0 && value.length <= 50;
        errorMessage = 'Name must be 1-50 characters';
        break;
      case 'whatsappNumber':
        const normalized = value.replace(/\D/g, '');
        isValid = normalized.length >= 10 && (normalized.startsWith('62') || normalized.startsWith('0'));
        errorMessage = 'Please enter a valid Indonesian phone number';
        break;
    }
    
    // Update field styling
    if (value.length === 0) {
      // Empty field - neutral state
      input.classList.remove('border-red-500', 'border-green-500');
    } else if (isValid) {
      input.classList.remove('border-red-500');
      input.classList.add('border-green-500');
    } else {
      input.classList.remove('border-green-500');
      input.classList.add('border-red-500');
    }
    
    return isValid;
  }

  validateQuantity() {
    const quantityInput = document.getElementById('quantity');
    if (!quantityInput) return true;
    
    const quantity = parseInt(quantityInput.value);
    const maxQuantity = configManager.getMaxQuantity(this.currentCategory || 'rgt');
    
    const isValid = quantity > 0 && quantity <= maxQuantity;
    
    if (isValid) {
      quantityInput.classList.remove('border-red-500');
      quantityInput.classList.add('border-green-500');
    } else {
      quantityInput.classList.remove('border-green-500');
      quantityInput.classList.add('border-red-500');
    }
    
    return isValid;
  }

  updateFormValidity() {
    const requiredFields = ['world', 'growId', 'customerName', 'whatsappNumber'];
    let isValid = true;
    
    requiredFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field || !this.validateField(field)) {
        isValid = false;
      }
    });
    
    isValid = isValid && this.validateQuantity();
    
    this.isFormValid = isValid;
    
    // Update submit button state if not in captcha mode
    if (!captchaManager.isCaptchaVerified()) {
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        if (isValid) {
          submitBtn.removeAttribute('disabled');
        } else {
          submitBtn.setAttribute('disabled', 'true');
        }
      }
    }
  }

  calculateTotalPrice() {
    const quantityInput = document.getElementById('quantity');
    const totalPriceInput = document.getElementById('totalPrice');
    
    if (!quantityInput || !totalPriceInput) return;
    
    const quantity = parseInt(quantityInput.value) || 1;
    let unitPrice = 0;
    
    if (this.currentCategory === 'rgt') {
      const selectedType = document.querySelector('input[name="purchaseType"]:checked')?.value;
      if (selectedType) {
        unitPrice = configManager.getRGTPrice(selectedType);
      }
    } else if (this.currentCategory === 'rps') {
      const selectedItem = document.querySelector('input[name="itemKey"]:checked')?.value;
      if (selectedItem) {
        unitPrice = configManager.getRPSPrice(selectedItem);
      }
    }
    
    const totalPrice = configManager.calculateTotal(unitPrice, quantity);
    totalPriceInput.value = i18n.formatCurrency(totalPrice);
  }

  async handleFormSubmit() {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        authManager.showMessage('warning', 'Please login to place an order');
        authManager.showAuthModal();
        return;
      }
      
      // If captcha not verified, verify it first
      if (!captchaManager.isCaptchaVerified()) {
        const captchaVerified = await captchaManager.handleCaptchaSubmit();
        if (!captchaVerified) {
          return; // Captcha verification failed
        }
      }
      
      // If payment method not selected, show error
      if (!paymentManager.getSelectedPaymentMethod()) {
        this.showMessage('error', 'Please select a payment method');
        return;
      }
      
      // Validate form
      if (!this.isFormValid) {
        this.showMessage('error', 'Please fill in all required fields correctly');
        return;
      }
      
      // Show loading
      this.showLoading(true);
      
      // Collect form data
      const formData = this.collectFormData();
      
      // Create order
      const result = await paymentManager.createOrder(formData);
      
      if (result.success) {
        // Show payment confirmation modal
        paymentManager.showProofModal();
      } else {
        throw new Error('Failed to create order');
      }
      
    } catch (error) {
      console.error('Form submission error:', error);
      this.showMessage('error', error.message || 'Failed to submit order. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  collectFormData() {
    const getValue = (id) => document.getElementById(id)?.value || '';
    
    const baseData = {
      world: getValue('world'),
      growId: getValue('growId'),
      customerName: getValue('customerName'),
      whatsappNumber: getValue('whatsappNumber'),
      quantity: parseInt(getValue('quantity')) || 1,
      notes: getValue('notes'),
      category: this.currentCategory,
      captchaToken: getValue('captchaId') // Captcha token
    };
    
    if (this.currentCategory === 'rgt') {
      baseData.purchaseType = document.querySelector('input[name="purchaseType"]:checked')?.value;
    } else if (this.currentCategory === 'rps') {
      baseData.itemKey = document.querySelector('input[name="itemKey"]:checked')?.value;
    }
    
    return baseData;
  }

  setupEventListeners() {
    // Listen for config updates
    window.addEventListener('pricesUpdated', () => {
      if (this.currentCategory === 'rgt') {
        this.updateRGTPrices();
      }
      this.calculateTotalPrice();
    });
    
    window.addEventListener('rpsItemsUpdated', () => {
      if (this.currentCategory === 'rps') {
        this.setupProductSelection('rps');
      }
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      const path = window.location.pathname;
      if (path === '/') {
        this.showHome();
      } else if (path === '/rgt') {
        this.showPurchaseForm('rgt');
      } else if (path === '/rps') {
        this.showPurchaseForm('rps');
      }
    });
    
    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.currentView === 'purchase') {
        // Refresh captcha when page becomes visible again
        setTimeout(() => {
          captchaManager.refreshCaptcha();
        }, 1000);
      }
    });
  }

  resetForm() {
    const form = document.getElementById('purchaseForm');
    if (form) {
      form.reset();
    }
    
    // Reset validation styling
    const inputs = form?.querySelectorAll('input, textarea');
    inputs?.forEach(input => {
      input.classList.remove('border-red-500', 'border-green-500');
    });
    
    // Reset calculated values
    const totalPrice = document.getElementById('totalPrice');
    if (totalPrice) totalPrice.value = '';
    
    this.isFormValid = false;
  }

  updateFormLabels() {
    // Update form labels when language changes
    // This is handled automatically by i18n.updateUI()
    
    // Recalculate prices with new currency format
    this.calculateTotalPrice();
    
    if (this.currentCategory === 'rgt') {
      this.updateRGTPrices();
    }
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
      overlay?.classList.remove('hidden');
    } else {
      overlay?.classList.add('hidden');
    }
  }

  showMessage(type, message) {
    if (authManager && typeof authManager.showMessage === 'function') {
      authManager.showMessage(type, message);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  // Public methods for external access
  getCurrentCategory() {
    return this.currentCategory;
  }

  getCurrentView() {
    return this.currentView;
  }

  isFormValidated() {
    return this.isFormValid;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.growtopiaShopApp = new GrowtopiaShopApp();
});

// Handle any uncaught errors gracefully
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  
  // Show user-friendly error message
  if (window.authManager && typeof window.authManager.showMessage === 'function') {
    window.authManager.showMessage('error', 'An unexpected error occurred. Please refresh the page and try again.');
  }
});

// Service Worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
