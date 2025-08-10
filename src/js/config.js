// Configuration management module
import { ref, get, set, update, onValue, off } from 'firebase/database';
import { shopDB, handleFirebaseError } from './firebase.js';
import i18n from './i18n.js';

class ConfigManager {
  constructor() {
    this.config = {};
    this.listeners = new Map();
    this.isLoaded = false;
    this.init();
  }

  async init() {
    try {
      await this.loadConfig();
      this.setupRealtimeListeners();
      this.isLoaded = true;
    } catch (error) {
      console.error('Error initializing config:', error);
      this.loadDefaultConfig();
    }
  }

  async loadConfig() {
    const configRef = ref(shopDB, 'config');
    const snapshot = await get(configRef);
    
    if (snapshot.exists()) {
      this.config = snapshot.val();
    } else {
      // Initialize with default config
      await this.initializeDefaultConfig();
    }
    
    // Update UI with loaded config
    this.updateUI();
  }

  loadDefaultConfig() {
    this.config = {
      website_name: "Growtopia Shop",
      prices: {
        rgt: {
          dl: 35000,
          bgl: 70000
        },
        rps: {}
      },
      rps_items: [
        { key: "MPS", label_en: "Magic Pickaxe Seed", label_id: "Magic Pickaxe Seed", price: 50000 },
        { key: "CLOCK", label_en: "Clock", label_id: "Clock", price: 25000 },
        { key: "RAYMAN", label_en: "Rayman's Fist", label_id: "Rayman's Fist", price: 100000 },
        { key: "ZEUS", label_en: "Zeus Lightning Bolt", label_id: "Zeus Lightning Bolt", price: 150000 }
      ],
      payment_methods: {
        dana: {
          providerLabel: "DANA",
          accountNumber: "081234567890",
          accountName: "GT SHOP",
          instructions: "Transfer to DANA number above, then upload proof",
          qrImageUrl: ""
        },
        gopay: {
          providerLabel: "GoPay",
          accountNumber: "081234567890", 
          accountName: "GT SHOP",
          instructions: "Transfer to GoPay number above, then upload proof",
          qrImageUrl: ""
        }
      },
      captcha_mode: "manual",
      captcha_list: {},
      max_quantity: {
        rgt: 100,
        rps: 50
      },
      fee_percent: 0, // No additional fees by default
      mappings: {
        rgt_to_rps: {
          "DL": "BGL",
          "BGL": "CLOCK"
        }
      }
    };
    
    this.updateUI();
  }

  async initializeDefaultConfig() {
    try {
      const configRef = ref(shopDB, 'config');
      await set(configRef, this.config);
    } catch (error) {
      console.error('Error initializing default config:', error);
    }
  }

  setupRealtimeListeners() {
    // Listen for website name changes
    const websiteNameRef = ref(shopDB, 'config/website_name');
    onValue(websiteNameRef, (snapshot) => {
      if (snapshot.exists()) {
        this.config.website_name = snapshot.val();
        this.updateWebsiteName();
      }
    });

    // Listen for price changes
    const pricesRef = ref(shopDB, 'config/prices');
    onValue(pricesRef, (snapshot) => {
      if (snapshot.exists()) {
        this.config.prices = snapshot.val();
        this.notifyPriceUpdate();
      }
    });

    // Listen for RPS items changes
    const rpsItemsRef = ref(shopDB, 'config/rps_items');
    onValue(rpsItemsRef, (snapshot) => {
      if (snapshot.exists()) {
        this.config.rps_items = snapshot.val();
        this.notifyRPSItemsUpdate();
      }
    });

    // Listen for payment methods changes
    const paymentMethodsRef = ref(shopDB, 'config/payment_methods');
    onValue(paymentMethodsRef, (snapshot) => {
      if (snapshot.exists()) {
        this.config.payment_methods = snapshot.val();
        this.notifyPaymentMethodsUpdate();
      }
    });
  }

  updateUI() {
    this.updateWebsiteName();
    // Other UI updates will be triggered by specific components
  }

  updateWebsiteName() {
    const nameElement = document.getElementById('websiteName');
    if (nameElement) {
      nameElement.textContent = this.config.website_name || 'Growtopia Shop';
    }
    
    // Update page title
    document.title = `${this.config.website_name || 'Growtopia Shop'} - Premium RGT & RPS Services`;
  }

  // Getters
  getWebsiteName() {
    return this.config.website_name || 'Growtopia Shop';
  }

  getRGTPrice(type) {
    return this.config.prices?.rgt?.[type.toLowerCase()] || 0;
  }

  getRPSPrice(itemKey) {
    const item = this.config.rps_items?.find(item => item.key === itemKey);
    return item?.price || 0;
  }

  getRPSItems() {
    return this.config.rps_items || [];
  }

  getPaymentMethods() {
    return this.config.payment_methods || {};
  }

  getCaptchaMode() {
    return this.config.captcha_mode || 'manual';
  }

  getCaptchaList() {
    return this.config.captcha_list || {};
  }

  getMaxQuantity(category) {
    return this.config.max_quantity?.[category] || 100;
  }

  getFeePercent() {
    return this.config.fee_percent || 0;
  }

  getMappings() {
    return this.config.mappings || {};
  }

  // Setters (for admin use)
  async updateWebsiteName(name) {
    try {
      const nameRef = ref(shopDB, 'config/website_name');
      await set(nameRef, name);
      return { success: true };
    } catch (error) {
      console.error('Error updating website name:', error);
      return { success: false, error: handleFirebaseError(error) };
    }
  }

  async updateRGTPrice(type, price) {
    try {
      const priceRef = ref(shopDB, `config/prices/rgt/${type.toLowerCase()}`);
      await set(priceRef, parseFloat(price));
      return { success: true };
    } catch (error) {
      console.error('Error updating RGT price:', error);
      return { success: false, error: handleFirebaseError(error) };
    }
  }

  async updateRPSItem(itemKey, itemData) {
    try {
      const items = [...(this.config.rps_items || [])];
      const index = items.findIndex(item => item.key === itemKey);
      
      if (index >= 0) {
        items[index] = { ...items[index], ...itemData };
      } else {
        items.push({ key: itemKey, ...itemData });
      }
      
      const itemsRef = ref(shopDB, 'config/rps_items');
      await set(itemsRef, items);
      return { success: true };
    } catch (error) {
      console.error('Error updating RPS item:', error);
      return { success: false, error: handleFirebaseError(error) };
    }
  }

  async removeRPSItem(itemKey) {
    try {
      const items = (this.config.rps_items || []).filter(item => item.key !== itemKey);
      const itemsRef = ref(shopDB, 'config/rps_items');
      await set(itemsRef, items);
      return { success: true };
    } catch (error) {
      console.error('Error removing RPS item:', error);
      return { success: false, error: handleFirebaseError(error) };
    }
  }

  async updatePaymentMethod(key, methodData) {
    try {
      const methodRef = ref(shopDB, `config/payment_methods/${key}`);
      await set(methodRef, methodData);
      return { success: true };
    } catch (error) {
      console.error('Error updating payment method:', error);
      return { success: false, error: handleFirebaseError(error) };
    }
  }

  async removePaymentMethod(key) {
    try {
      const methodRef = ref(shopDB, `config/payment_methods/${key}`);
      await set(methodRef, null);
      return { success: true };
    } catch (error) {
      console.error('Error removing payment method:', error);
      return { success: false, error: handleFirebaseError(error) };
    }
  }

  // Event handling
  notifyPriceUpdate() {
    window.dispatchEvent(new CustomEvent('pricesUpdated', { 
      detail: this.config.prices 
    }));
  }

  notifyRPSItemsUpdate() {
    window.dispatchEvent(new CustomEvent('rpsItemsUpdated', { 
      detail: this.config.rps_items 
    }));
  }

  notifyPaymentMethodsUpdate() {
    window.dispatchEvent(new CustomEvent('paymentMethodsUpdated', { 
      detail: this.config.payment_methods 
    }));
  }

  // Validation helpers
  validatePrice(price) {
    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice > 0;
  }

  validateQuantity(quantity, category = 'rgt') {
    const num = parseInt(quantity);
    const max = this.getMaxQuantity(category);
    return !isNaN(num) && num > 0 && num <= max;
  }

  // Calculation helpers
  calculateTotal(unitPrice, quantity, includeFee = true) {
    let total = unitPrice * quantity;
    
    if (includeFee && this.getFeePercent() > 0) {
      total *= (1 + this.getFeePercent() / 100);
    }
    
    return Math.round(total);
  }

  // Wait for config to be loaded
  async waitForLoad() {
    return new Promise((resolve) => {
      if (this.isLoaded) {
        resolve();
        return;
      }

      const checkLoaded = () => {
        if (this.isLoaded) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      
      checkLoaded();
    });
  }

  // Cleanup
  destroy() {
    // Remove all listeners
    this.listeners.forEach((unsubscribe, path) => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.listeners.clear();
  }
}

// Create global config instance
const configManager = new ConfigManager();

// Export for use in other modules
export default configManager;

// Also make it available globally
window.configManager = configManager;
