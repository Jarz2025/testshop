// Authentication module
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { ref, set, get, update } from 'firebase/database';
import { auth, authDB, handleFirebaseError, checkRateLimit } from './firebase.js';
import i18n from './i18n.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.authStateCallbacks = [];
    this.init();
  }

  async init() {
    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      
      if (user) {
        // User is signed in
        await this.handleUserSignIn(user);
      } else {
        // User is signed out
        this.handleUserSignOut();
      }

      // Trigger callbacks
      this.authStateCallbacks.forEach(callback => callback(user));
      
      if (!this.isInitialized) {
        this.isInitialized = true;
        this.initializeUI();
      }
    });
  }

  async handleUserSignIn(user) {
    try {
      // Check if email is verified
      if (!user.emailVerified) {
        this.showMessage('warning', i18n.t('auth.emailVerification'));
        return;
      }

      // Update/create user profile in database
      const userRef = ref(authDB, `users/${user.uid}/profile`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        // New user - create profile
        await set(userRef, {
          email: user.email,
          displayName: user.displayName || '',
          phone: '',
          registrationDate: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
      } else {
        // Existing user - update last login
        await update(userRef, {
          lastLogin: new Date().toISOString()
        });
      }

      // Update UI
      this.updateAuthUI();
      this.showMessage('success', i18n.t('auth.loginSuccess'));
    } catch (error) {
      console.error('Error handling user sign in:', error);
      this.showMessage('error', handleFirebaseError(error));
    }
  }

  handleUserSignOut() {
    this.currentUser = null;
    this.updateAuthUI();
  }

  initializeUI() {
    // Initialize auth modal
    this.setupAuthModal();
    this.updateAuthUI();
  }

  setupAuthModal() {
    const loginBtn = document.getElementById('loginBtn');
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const authContent = document.getElementById('authContent');

    // Login button click
    loginBtn?.addEventListener('click', () => {
      if (this.currentUser) {
        this.signOut();
      } else {
        this.showAuthModal();
      }
    });

    // Close modal
    closeAuthModal?.addEventListener('click', () => {
      this.hideAuthModal();
    });

    // Close modal on backdrop click
    authModal?.addEventListener('click', (e) => {
      if (e.target === authModal) {
        this.hideAuthModal();
      }
    });

    // Create auth form
    this.createAuthForm();
  }

  createAuthForm() {
    const authContent = document.getElementById('authContent');
    if (!authContent) return;

    authContent.innerHTML = `
      <div id="authTabs" class="flex mb-6 bg-gray-700 rounded-lg p-1">
        <button id="loginTab" class="flex-1 py-2 px-4 rounded-md transition-colors bg-emerald-600 text-white">
          ${i18n.t('auth.login')}
        </button>
        <button id="registerTab" class="flex-1 py-2 px-4 rounded-md transition-colors text-gray-300 hover:text-white">
          ${i18n.t('auth.register')}
        </button>
      </div>

      <div id="loginForm">
        <form class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">${i18n.t('auth.email')}</label>
            <input type="email" id="loginEmail" required class="form-input">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">${i18n.t('auth.password')}</label>
            <input type="password" id="loginPassword" required class="form-input">
          </div>
          <button type="submit" id="loginSubmit" class="btn-primary w-full">
            ${i18n.t('auth.login')}
          </button>
          <div class="text-center">
            <button type="button" id="forgotPasswordBtn" class="text-emerald-400 hover:text-emerald-300 text-sm">
              ${i18n.t('auth.forgotPassword')}
            </button>
          </div>
        </form>
      </div>

      <div id="registerForm" class="hidden">
        <form class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">${i18n.t('auth.email')}</label>
            <input type="email" id="registerEmail" required class="form-input">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">${i18n.t('auth.password')}</label>
            <input type="password" id="registerPassword" required minlength="6" class="form-input">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">${i18n.t('auth.confirmPassword')}</label>
            <input type="password" id="confirmPassword" required minlength="6" class="form-input">
          </div>
          <button type="submit" id="registerSubmit" class="btn-primary w-full">
            ${i18n.t('auth.register')}
          </button>
        </form>
      </div>
    `;

    // Add event listeners
    this.setupAuthFormListeners();
  }

  setupAuthFormListeners() {
    // Tab switching
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    loginTab?.addEventListener('click', () => {
      this.switchAuthTab('login');
    });

    registerTab?.addEventListener('click', () => {
      this.switchAuthTab('register');
    });

    // Form submissions
    const loginFormElement = loginForm?.querySelector('form');
    const registerFormElement = registerForm?.querySelector('form');

    loginFormElement?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    registerFormElement?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    // Forgot password
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    forgotPasswordBtn?.addEventListener('click', () => {
      this.handleForgotPassword();
    });
  }

  switchAuthTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (tab === 'login') {
      loginTab?.classList.add('bg-emerald-600', 'text-white');
      loginTab?.classList.remove('text-gray-300');
      registerTab?.classList.remove('bg-emerald-600', 'text-white');
      registerTab?.classList.add('text-gray-300');
      loginForm?.classList.remove('hidden');
      registerForm?.classList.add('hidden');
    } else {
      registerTab?.classList.add('bg-emerald-600', 'text-white');
      registerTab?.classList.remove('text-gray-300');
      loginTab?.classList.remove('bg-emerald-600', 'text-white');
      loginTab?.classList.add('text-gray-300');
      registerForm?.classList.remove('hidden');
      loginForm?.classList.add('hidden');
    }
  }

  async handleLogin() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
      this.showMessage('error', 'Please fill in all fields');
      return;
    }

    // Rate limiting check
    if (!checkRateLimit(`login:${email}`, 5, 300000)) { // 5 attempts per 5 minutes
      this.showMessage('error', 'Too many login attempts. Please try again later.');
      return;
    }

    try {
      this.showLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      this.hideAuthModal();
    } catch (error) {
      console.error('Login error:', error);
      this.showMessage('error', handleFirebaseError(error));
    } finally {
      this.showLoading(false);
    }
  }

  async handleRegister() {
    const email = document.getElementById('registerEmail')?.value;
    const password = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    if (!email || !password || !confirmPassword) {
      this.showMessage('error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      this.showMessage('error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      this.showMessage('error', 'Password must be at least 6 characters');
      return;
    }

    // Rate limiting check
    if (!checkRateLimit(`register:${email}`, 3, 3600000)) { // 3 attempts per hour
      this.showMessage('error', 'Too many registration attempts. Please try again later.');
      return;
    }

    try {
      this.showLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      await sendEmailVerification(userCredential.user);
      
      this.showMessage('success', i18n.t('auth.registerSuccess'));
      this.hideAuthModal();
    } catch (error) {
      console.error('Registration error:', error);
      this.showMessage('error', handleFirebaseError(error));
    } finally {
      this.showLoading(false);
    }
  }

  async handleForgotPassword() {
    const email = document.getElementById('loginEmail')?.value;
    
    if (!email) {
      this.showMessage('error', 'Please enter your email address first');
      return;
    }

    try {
      this.showLoading(true);
      await sendPasswordResetEmail(auth, email);
      this.showMessage('success', 'Password reset email sent. Check your inbox.');
    } catch (error) {
      console.error('Password reset error:', error);
      this.showMessage('error', handleFirebaseError(error));
    } finally {
      this.showLoading(false);
    }
  }

  async signOut() {
    try {
      await signOut(auth);
      this.showMessage('success', 'Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      this.showMessage('error', handleFirebaseError(error));
    }
  }

  updateAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    
    if (this.currentUser && this.currentUser.emailVerified) {
      if (loginBtn) {
        loginBtn.textContent = i18n.t('auth.logout');
        loginBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
        loginBtn.classList.add('bg-red-600', 'hover:bg-red-700');
      }
      
      // Show user info if needed
      this.displayUserInfo();
    } else {
      if (loginBtn) {
        loginBtn.textContent = i18n.t('auth.login');
        loginBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        loginBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
      }
    }
  }

  displayUserInfo() {
    // Update header with user info if needed
    const userInfoElement = document.querySelector('.user-info');
    if (userInfoElement && this.currentUser) {
      userInfoElement.innerHTML = `
        <span class="text-sm text-gray-400">Welcome, ${this.currentUser.email}</span>
      `;
    }
  }

  showAuthModal() {
    const authModal = document.getElementById('authModal');
    authModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  hideAuthModal() {
    const authModal = document.getElementById('authModal');
    authModal?.classList.add('hidden');
    document.body.style.overflow = '';
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
    const container = document.getElementById('messageContainer');
    if (!container) return;

    const messageEl = document.createElement('div');
    messageEl.className = `message-${type}`;
    messageEl.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        ${type === 'success' ? 
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>' :
          type === 'error' ?
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.316 16.5c-.77.833.192 2.5 1.732 2.5z"/>' :
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
        }
      </svg>
      <span>${message}</span>
      <button onclick="this.parentElement.remove()" class="ml-auto">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    container.appendChild(messageEl);

    // Auto remove after 5 seconds
    setTimeout(() => {
      messageEl.remove();
    }, 5000);
  }

  // Public methods
  isAuthenticated() {
    return this.currentUser && this.currentUser.emailVerified;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  onAuthStateChange(callback) {
    this.authStateCallbacks.push(callback);
    
    // Call immediately if already initialized
    if (this.isInitialized) {
      callback(this.currentUser);
    }
  }

  requireAuth(callback) {
    if (this.isAuthenticated()) {
      callback();
    } else {
      this.showMessage('warning', 'Please login to continue');
      this.showAuthModal();
    }
  }
}

// Create global auth instance
const authManager = new AuthManager();

// Export for use in other modules
export default authManager;

// Also make it available globally
window.authManager = authManager;
