// Internationalization module
class I18n {
  constructor() {
    this.currentLang = 'en';
    this.translations = {};
    this.fallbackLang = 'en';
    this.loadTranslations();
  }

  async loadTranslations() {
    // Default translations
    this.translations = {
      en: {
        header: {
          subtitle: "Premium Growtopia Services"
        },
        auth: {
          login: "Login",
          register: "Register",
          title: "Login / Register",
          logout: "Logout",
          email: "Email Address",
          password: "Password",
          confirmPassword: "Confirm Password",
          forgotPassword: "Forgot Password?",
          loginSuccess: "Login successful!",
          registerSuccess: "Registration successful! Please verify your email.",
          emailVerification: "Please verify your email address to continue."
        },
        home: {
          hero: {
            title: "Welcome to the Best Growtopia Shop",
            description: "Fast, secure, and reliable service for all your Growtopia needs"
          }
        },
        categories: {
          rgt: {
            title: "RGT Services",
            description: "Diamond Locks & Blue Gem Locks",
            note: "Fast delivery to your world"
          },
          rps: {
            title: "RPS Items",
            description: "Premium custom items & services",
            note: "Special items for your collection"
          }
        },
        features: {
          fast: {
            title: "Fast Delivery",
            description: "Quick processing within minutes"
          },
          secure: {
            title: "Secure Payment",
            description: "Safe and encrypted transactions"
          },
          support: {
            title: "24/7 Support",
            description: "Always here to help you"
          }
        },
        form: {
          world: "World Name",
          growid: "GrowID",
          name: "Full Name",
          whatsapp: "WhatsApp Number",
          quantity: "Quantity",
          total: "Total Price",
          notes: "Special Instructions",
          submit: "Place Order",
          world: {
            placeholder: "Enter world name"
          },
          growid: {
            placeholder: "Enter your GrowID"
          },
          name: {
            placeholder: "Enter your full name"
          },
          notes: {
            placeholder: "Any special requests or instructions (optional)"
          }
        },
        navigation: {
          back: "Back to Home"
        },
        captcha: {
          title: "Security Verification",
          placeholder: "Enter the text you see",
          refresh: "🔄 Refresh Captcha",
          verify: "Verify Captcha",
          success: "Captcha verified successfully!",
          error: "Invalid captcha. Please try again."
        },
        payment: {
          title: "Payment Methods",
          selectMethod: "Select payment method:",
          accountNumber: "Account Number",
          accountName: "Account Name",
          instructions: "Payment Instructions",
          copyAccount: "Copy Account Number",
          copied: "Copied to clipboard!",
          confirmPayment: "I have paid, upload proof"
        },
        proof: {
          title: "Upload Payment Proof",
          description: "Please upload your payment screenshot",
          drop: "Click or drag to upload",
          format: "JPG, PNG, WebP (Max 10MB)",
          remove: "Remove",
          upload: "Upload Proof",
          success: "Payment proof uploaded successfully!",
          error: "Error uploading proof. Please try again."
        },
        chat: {
          title: "Customer Support",
          welcome: "Welcome! How can we help you today?",
          placeholder: "Type your message...",
          send: "Send",
          connecting: "Connecting to support...",
          error: "Error connecting to support. Please try again."
        },
        orders: {
          status: {
            pending_confirmation: "Pending Confirmation",
            awaiting_payment: "Awaiting Payment",
            awaiting_admin_review: "Under Review",
            processed: "Order Processed",
            declined: "Order Declined",
            completed: "Completed",
            refunded: "Refunded"
          }
        },
        common: {
          loading: "Processing...",
          cancel: "Cancel",
          confirm: "Confirm",
          close: "Close",
          save: "Save",
          delete: "Delete",
          edit: "Edit",
          yes: "Yes",
          no: "No",
          error: "Error",
          success: "Success",
          warning: "Warning",
          info: "Information"
        }
      },
      id: {
        header: {
          subtitle: "Layanan Premium Growtopia"
        },
        auth: {
          login: "Masuk",
          register: "Daftar",
          title: "Masuk / Daftar",
          logout: "Keluar",
          email: "Alamat Email",
          password: "Kata Sandi",
          confirmPassword: "Konfirmasi Kata Sandi",
          forgotPassword: "Lupa Kata Sandi?",
          loginSuccess: "Berhasil masuk!",
          registerSuccess: "Pendaftaran berhasil! Silakan verifikasi email Anda.",
          emailVerification: "Silakan verifikasi alamat email Anda untuk melanjutkan."
        },
        home: {
          hero: {
            title: "Selamat Datang di Toko Growtopia Terbaik",
            description: "Layanan cepat, aman, dan terpercaya untuk semua kebutuhan Growtopia Anda"
          }
        },
        categories: {
          rgt: {
            title: "Layanan RGT",
            description: "Diamond Lock & Blue Gem Lock",
            note: "Pengiriman cepat ke world Anda"
          },
          rps: {
            title: "Item RPS",
            description: "Item khusus premium & layanan",
            note: "Item spesial untuk koleksi Anda"
          }
        },
        features: {
          fast: {
            title: "Pengiriman Cepat",
            description: "Proses cepat dalam hitungan menit"
          },
          secure: {
            title: "Pembayaran Aman",
            description: "Transaksi aman dan terenkripsi"
          },
          support: {
            title: "Support 24/7",
            description: "Selalu siap membantu Anda"
          }
        },
        form: {
          world: "Nama World",
          growid: "GrowID",
          name: "Nama Lengkap",
          whatsapp: "Nomor WhatsApp",
          quantity: "Jumlah",
          total: "Total Harga",
          notes: "Instruksi Khusus",
          submit: "Buat Pesanan",
          world: {
            placeholder: "Masukkan nama world"
          },
          growid: {
            placeholder: "Masukkan GrowID Anda"
          },
          name: {
            placeholder: "Masukkan nama lengkap Anda"
          },
          notes: {
            placeholder: "Permintaan atau instruksi khusus (opsional)"
          }
        },
        navigation: {
          back: "Kembali ke Beranda"
        },
        captcha: {
          title: "Verifikasi Keamanan",
          placeholder: "Masukkan teks yang Anda lihat",
          refresh: "🔄 Refresh Captcha",
          verify: "Verifikasi Captcha",
          success: "Captcha berhasil diverifikasi!",
          error: "Captcha tidak valid. Silakan coba lagi."
        },
        payment: {
          title: "Metode Pembayaran",
          selectMethod: "Pilih metode pembayaran:",
          accountNumber: "Nomor Rekening",
          accountName: "Atas Nama",
          instructions: "Instruksi Pembayaran",
          copyAccount: "Salin Nomor Rekening",
          copied: "Disalin ke clipboard!",
          confirmPayment: "Saya sudah bayar, upload bukti"
        },
        proof: {
          title: "Upload Bukti Pembayaran",
          description: "Silakan upload screenshot pembayaran Anda",
          drop: "Klik atau drag untuk upload",
          format: "JPG, PNG, WebP (Maks 10MB)",
          remove: "Hapus",
          upload: "Upload Bukti",
          success: "Bukti pembayaran berhasil diupload!",
          error: "Error saat upload bukti. Silakan coba lagi."
        },
        chat: {
          title: "Customer Support",
          welcome: "Selamat datang! Bagaimana kami bisa membantu Anda hari ini?",
          placeholder: "Ketik pesan Anda...",
          send: "Kirim",
          connecting: "Menghubungkan ke support...",
          error: "Error saat menghubungkan ke support. Silakan coba lagi."
        },
        orders: {
          status: {
            pending_confirmation: "Menunggu Konfirmasi",
            awaiting_payment: "Menunggu Pembayaran",
            awaiting_admin_review: "Sedang Direview",
            processed: "Pesanan Diproses",
            declined: "Pesanan Ditolak",
            completed: "Selesai",
            refunded: "Dikembalikan"
          }
        },
        common: {
          loading: "Memproses...",
          cancel: "Batal",
          confirm: "Konfirmasi",
          close: "Tutup",
          save: "Simpan",
          delete: "Hapus",
          edit: "Edit",
          yes: "Ya",
          no: "Tidak",
          error: "Error",
          success: "Berhasil",
          warning: "Peringatan",
          info: "Informasi"
        }
      }
    };

    // Load dynamic translations from Firebase if available
    await this.loadDynamicTranslations();

    // Set initial language from localStorage or browser
    const savedLang = localStorage.getItem('language') || 
                     (navigator.language.startsWith('id') ? 'id' : 'en');
    this.setLanguage(savedLang);
  }

  async loadDynamicTranslations() {
    try {
      // Import Firebase modules
      const { ref, get } = await import('firebase/database');
      const { shopDB } = await import('./firebase.js');

      // Load dynamic translations from Firebase
      const translationsRef = ref(shopDB, 'config/translations');
      const snapshot = await get(translationsRef);
      
      if (snapshot.exists()) {
        const dynamicTranslations = snapshot.val();
        
        // Merge with existing translations
        Object.keys(dynamicTranslations).forEach(lang => {
          if (!this.translations[lang]) {
            this.translations[lang] = {};
          }
          this.translations[lang] = {
            ...this.translations[lang],
            ...dynamicTranslations[lang]
          };
        });
      }
    } catch (error) {
      console.warn('Could not load dynamic translations:', error);
    }
  }

  setLanguage(lang) {
    if (!this.translations[lang]) {
      console.warn(`Language ${lang} not found, falling back to ${this.fallbackLang}`);
      lang = this.fallbackLang;
    }

    this.currentLang = lang;
    localStorage.setItem('language', lang);
    
    // Update document language
    document.documentElement.lang = lang;
    
    // Update all translatable elements
    this.updateUI();
    
    // Trigger language change event
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];
    
    // Traverse the translation object
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = this.translations[this.fallbackLang];
        for (const fallbackK of keys) {
          if (value && typeof value === 'object' && fallbackK in value) {
            value = value[fallbackK];
          } else {
            value = key; // Return key if translation not found
            break;
          }
        }
        break;
      }
    }
    
    // Handle string interpolation
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      Object.keys(params).forEach(param => {
        value = value.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
      });
    }
    
    return value || key;
  }

  updateUI() {
    // Update all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key);
      
      // Handle different element types
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (element.type === 'submit' || element.type === 'button') {
          element.value = translation;
        } else {
          element.placeholder = translation;
        }
      } else {
        element.textContent = translation;
      }
    });

    // Update page title if needed
    const titleKey = document.querySelector('meta[name="title-key"]');
    if (titleKey) {
      document.title = this.t(titleKey.content);
    }
  }

  getCurrentLanguage() {
    return this.currentLang;
  }

  getAvailableLanguages() {
    return Object.keys(this.translations);
  }

  // Pluralization helper
  plural(key, count, params = {}) {
    const pluralKey = count === 1 ? `${key}.singular` : `${key}.plural`;
    return this.t(pluralKey, { ...params, count });
  }

  // Date/time formatting
  formatDate(date, format = 'short') {
    const locale = this.currentLang === 'id' ? 'id-ID' : 'en-US';
    const options = {
      short: { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      },
      long: { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      },
      time: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: this.currentLang !== 'id'
      }
    };

    return new Intl.DateTimeFormat(locale, options[format]).format(new Date(date));
  }

  // Currency formatting
  formatCurrency(amount, currency = 'IDR') {
    const locale = this.currentLang === 'id' ? 'id-ID' : 'en-US';
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      // Fallback formatting
      return `${currency} ${amount.toLocaleString(locale)}`;
    }
  }

  // Number formatting
  formatNumber(number) {
    const locale = this.currentLang === 'id' ? 'id-ID' : 'en-US';
    return new Intl.NumberFormat(locale).format(number);
  }
}

// Create global i18n instance
const i18n = new I18n();

// Export for use in other modules
export default i18n;

// Also make it available globally for backwards compatibility
window.i18n = i18n;
