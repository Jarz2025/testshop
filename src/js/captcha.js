// Captcha management module
import { ref, get, set } from 'firebase/database';
import { shopDB, handleFirebaseError, checkRateLimit } from './firebase.js';
import configManager from './config.js';

class CaptchaManager {
  constructor() {
    this.currentCaptcha = null;
    this.isVerified = false;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  async loadCaptcha() {
    try {
      const mode = configManager.getCaptchaMode();
      
      if (mode === 'google') {
        return await this.loadGoogleCaptcha();
      } else {
        return await this.loadManualCaptcha();
      }
    } catch (error) {
      console.error('Error loading captcha:', error);
      throw new Error('Failed to load captcha. Please try again.');
    }
  }

  async loadManualCaptcha() {
    // Get captcha list from config
    const captchaList = configManager.getCaptchaList();
    const captchaIds = Object.keys(captchaList);
    
    if (captchaIds.length === 0) {
      throw new Error('No captcha images available. Please contact admin.');
    }
    
    // Select random captcha
    const randomIndex = Math.floor(Math.random() * captchaIds.length);
    const captchaId = captchaIds[randomIndex];
    const captchaData = captchaList[captchaId];
    
    this.currentCaptcha = {
      id: captchaId,
      imageUrl: captchaData.imageUrl,
      answerHash: captchaData.answerHash
    };
    
    return this.currentCaptcha;
  }

  async loadGoogleCaptcha() {
    // This would integrate with Google reCAPTCHA
    // For now, return null to indicate Google captcha should be loaded
    return null;
  }

  async verifyCaptcha(captchaId, answer) {
    try {
      // Rate limiting
      const clientId = this.getClientId();
      if (!checkRateLimit(`captcha:${clientId}`, 10, 300000)) {
        throw new Error('Too many captcha attempts. Please try again later.');
      }

      // Increment retry count
      this.retryCount++;
      if (this.retryCount > this.maxRetries) {
        throw new Error('Maximum captcha attempts exceeded. Please refresh and try again.');
      }

      const mode = configManager.getCaptchaMode();
      
      if (mode === 'google') {
        return await this.verifyGoogleCaptcha(answer);
      } else {
        return await this.verifyManualCaptcha(captchaId, answer);
      }
    } catch (error) {
      console.error('Captcha verification error:', error);
      throw error;
    }
  }

  async verifyManualCaptcha(captchaId, answer) {
    if (!captchaId || !answer) {
      throw new Error('Captcha ID and answer are required');
    }

    // Clean up the answer
    const cleanAnswer = answer.toLowerCase().trim();
    
    // Get captcha data
    const captchaList = configManager.getCaptchaList();
    const captchaData = captchaList[captchaId];
    
    if (!captchaData) {
      throw new Error('Invalid captcha ID');
    }

    // Hash the answer and compare
    const hashedAnswer = await this.hashString(cleanAnswer);
    
    if (hashedAnswer === captchaData.answerHash) {
      this.isVerified = true;
      this.retryCount = 0; // Reset retry count on success
      return { success: true, token: this.generateCaptchaToken(captchaId) };
    } else {
      throw new Error('Invalid captcha answer. Please try again.');
    }
  }

  async verifyGoogleCaptcha(token) {
    // This would call a Cloud Function to verify the Google reCAPTCHA token
    // Return mock success for now
    this.isVerified = true;
    return { success: true, token };
  }

  async hashString(str) {
    // Simple hash function for captcha answers
    // In production, use a more secure hashing method
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  generateCaptchaToken(captchaId) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${captchaId}-${timestamp}-${randomStr}`;
  }

  getClientId() {
    // Generate a semi-persistent client ID for rate limiting
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
      clientId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('clientId', clientId);
    }
    return clientId;
  }

  // UI Integration Methods
  setupCaptchaUI() {
    const captchaSection = document.getElementById('captchaSection');
    const refreshBtn = document.getElementById('refreshCaptcha');
    const captchaInput = document.getElementById('captchaAnswer');
    const submitBtn = document.getElementById('submitBtn');

    if (!captchaSection) return;

    // Load initial captcha
    this.refreshCaptcha();

    // Refresh button handler
    refreshBtn?.addEventListener('click', () => {
      this.refreshCaptcha();
    });

    // Input validation
    captchaInput?.addEventListener('input', () => {
      const answer = captchaInput.value.trim();
      if (answer.length >= 3) {
        submitBtn?.removeAttribute('disabled');
      } else {
        submitBtn?.setAttribute('disabled', 'true');
      }
    });
  }

  async refreshCaptcha() {
    try {
      const captchaImage = document.getElementById('captchaImage');
      const captchaId = document.getElementById('captchaId');
      const captchaInput = document.getElementById('captchaAnswer');
      
      // Show loading state
      if (captchaImage) {
        captchaImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+Cjwvc3ZnPg==';
        captchaImage.alt = 'Loading captcha...';
      }

      // Clear previous values
      if (captchaInput) captchaInput.value = '';
      this.isVerified = false;

      // Load new captcha
      const captcha = await this.loadCaptcha();
      
      if (captcha) {
        // Manual captcha
        if (captchaImage) {
          captchaImage.src = captcha.imageUrl;
          captchaImage.alt = 'Captcha image';
        }
        if (captchaId) {
          captchaId.value = captcha.id;
        }
      } else {
        // Google captcha would be initialized here
        console.log('Google captcha would be loaded here');
      }
    } catch (error) {
      console.error('Error refreshing captcha:', error);
      this.showCaptchaError('Failed to load captcha. Please try again.');
    }
  }

  async handleCaptchaSubmit() {
    const captchaId = document.getElementById('captchaId')?.value;
    const captchaAnswer = document.getElementById('captchaAnswer')?.value;

    if (!captchaAnswer || captchaAnswer.trim().length < 1) {
      this.showCaptchaError('Please enter the captcha text');
      return false;
    }

    try {
      this.showCaptchaLoading(true);
      
      const result = await this.verifyCaptcha(captchaId, captchaAnswer);
      
      if (result.success) {
        this.showCaptchaSuccess();
        this.showPaymentSection();
        return true;
      } else {
        throw new Error('Captcha verification failed');
      }
    } catch (error) {
      this.showCaptchaError(error.message);
      this.refreshCaptcha(); // Load new captcha on error
      return false;
    } finally {
      this.showCaptchaLoading(false);
    }
  }

  showPaymentSection() {
    const paymentSection = document.getElementById('paymentSection');
    const submitBtn = document.getElementById('submitBtn');
    
    if (paymentSection) {
      paymentSection.classList.remove('hidden');
      paymentSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    if (submitBtn) {
      submitBtn.textContent = 'Proceed to Payment';
      submitBtn.setAttribute('data-i18n', 'payment.proceed');
    }
  }

  showCaptchaLoading(show) {
    const submitBtn = document.getElementById('submitBtn');
    const refreshBtn = document.getElementById('refreshCaptcha');
    
    if (show) {
      submitBtn?.setAttribute('disabled', 'true');
      refreshBtn?.setAttribute('disabled', 'true');
      if (submitBtn) submitBtn.innerHTML = '<div class="loading-dots">Verifying</div>';
    } else {
      submitBtn?.removeAttribute('disabled');
      refreshBtn?.removeAttribute('disabled');
      if (submitBtn) submitBtn.textContent = 'Verify Captcha';
    }
  }

  showCaptchaSuccess() {
    this.showMessage('success', 'Captcha verified successfully!');
  }

  showCaptchaError(message) {
    this.showMessage('error', message);
  }

  showMessage(type, message) {
    // Use the global message system
    if (window.authManager && typeof window.authManager.showMessage === 'function') {
      window.authManager.showMessage(type, message);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  // Public methods
  isCaptchaVerified() {
    return this.isVerified;
  }

  resetCaptcha() {
    this.isVerified = false;
    this.retryCount = 0;
    this.currentCaptcha = null;
    
    // Hide payment section if visible
    const paymentSection = document.getElementById('paymentSection');
    paymentSection?.classList.add('hidden');
    
    // Reset submit button
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.textContent = 'Verify Captcha to Continue';
    }
  }

  // Admin methods for managing captcha assets
  async uploadCaptchaAsset(file, answer) {
    try {
      // This would handle uploading to Firebase Storage and updating the config
      // Implementation would be in admin panel
      console.log('Upload captcha asset:', file.name, answer);
      return { success: true };
    } catch (error) {
      console.error('Error uploading captcha asset:', error);
      return { success: false, error: error.message };
    }
  }

  async removeCaptchaAsset(captchaId) {
    try {
      // This would handle removing from storage and config
      console.log('Remove captcha asset:', captchaId);
      return { success: true };
    } catch (error) {
      console.error('Error removing captcha asset:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global captcha instance
const captchaManager = new CaptchaManager();

// Export for use in other modules
export default captchaManager;

// Also make it available globally
window.captchaManager = captchaManager;
