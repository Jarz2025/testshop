// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Firebase Config for Project B (Shop Data)
const firebaseConfigShop = {
  apiKey: "AIzaSyATcp07n9IFKvJza8eW544TMAmEPxHrfNw",
  authDomain: "shopgt1.firebaseapp.com",
  databaseURL: "https://shopgt1-default-rtdb.firebaseio.com",
  projectId: "shopgt1",
  storageBucket: "shopgt1.firebasestorage.app",
  messagingSenderId: "269253049928",
  appId: "1:269253049928:web:a83717e13e7768fa2aa27d"
};

// Firebase Config for Project A (Auth & User Data)
const firebaseConfigAuth = {
  apiKey: "AIzaSyANC8o5r8P_I2f3ZCR6jsHRQw_xBzWQDCI",
  authDomain: "web2-e7eee.firebaseapp.com",
  databaseURL: "https://web2-e7eee-default-rtdb.firebaseio.com",
  projectId: "web2-e7eee",
  storageBucket: "web2-e7eee.firebasestorage.app",
  messagingSenderId: "414850621933",
  appId: "1:414850621933:web:e923cc1554898e9d9687e4"
};

// Initialize Firebase apps
const shopApp = initializeApp(firebaseConfigShop, 'shop');
const authApp = initializeApp(firebaseConfigAuth, 'auth');

// Initialize services
export const auth = getAuth(authApp);
export const shopDB = getDatabase(shopApp);
export const authDB = getDatabase(authApp);
export const storage = getStorage(shopApp);

// Export apps for use in Cloud Functions
export { shopApp, authApp };

// Utility functions
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, 1000); // Limit length
};

export const validatePhone = (phone) => {
  const phoneRegex = /^\+62[0-9]{9,13}$/;
  return phoneRegex.test(phone);
};

export const normalizePhone = (phone) => {
  // Convert Indonesian phone numbers to E.164 format
  let normalized = phone.replace(/\D/g, ''); // Remove non-digits
  
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.substring(1);
  } else if (normalized.startsWith('62')) {
    // Already in correct format
  } else if (normalized.startsWith('8')) {
    normalized = '62' + normalized;
  }
  
  return '+' + normalized;
};

export const generateOrderId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `GT-${timestamp}-${randomStr}`.toUpperCase();
};

// Error handling utility
export const handleFirebaseError = (error) => {
  console.error('Firebase Error:', error);
  
  const errorMessages = {
    'auth/user-not-found': 'User not found. Please check your credentials.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'permission-denied': 'Permission denied. Please check your authentication.',
    'network-error': 'Network error. Please check your connection.',
    'default': 'An unexpected error occurred. Please try again.'
  };
  
  return errorMessages[error.code] || errorMessages['default'];
};

// Rate limiting helper
const rateLimits = new Map();

export const checkRateLimit = (key, maxRequests = 10, windowMs = 60000) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimits.has(key)) {
    rateLimits.set(key, []);
  }
  
  const requests = rateLimits.get(key);
  
  // Remove old requests outside the window
  while (requests.length > 0 && requests[0] < windowStart) {
    requests.shift();
  }
  
  // Check if limit exceeded
  if (requests.length >= maxRequests) {
    return false;
  }
  
  // Add current request
  requests.push(now);
  return true;
};

// Local storage helpers
export const storage_get = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
};

export const storage_set = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

export const storage_remove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
};

// Initialize error tracking
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // In production, send to error tracking service like Sentry
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // In production, send to error tracking service
});
