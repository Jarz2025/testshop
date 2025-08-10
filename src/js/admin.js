// Admin panel functionality
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  ref, 
  get, 
  set, 
  update, 
  remove, 
  onValue, 
  off,
  query,
  orderByChild,
  limitToLast
} from 'firebase/database';
import { 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { 
  auth, 
  shopDB, 
  storage, 
  handleFirebaseError,
  sanitizeInput 
} from './firebase.js';

class AdminPanel {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.currentTab = 'orders';
    this.orders = {};
    this.listeners = [];
    this.init();
  }

  async init() {
    // Check authentication state
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await this.checkAdminAccess(user);
      } else {
        this.showLoginForm();
      }
    });
  }

  async checkAdminAccess(user) {
    try {
      // Check if user is admin
      const adminRef = ref(shopDB, `admins/${user.uid}`);
      const snapshot = await get(adminRef);
      
      if (snapshot.exists() && snapshot.val().isAdmin) {
        this.currentUser = user;
        this.isAdmin = true;
        this.initializeAdminPanel();
      } else {
        await signOut(auth);
        this.showMessage('error', 'Access denied. Admin privileges required.');
        this.showLoginForm();
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      this.showMessage('error', 'Error verifying admin access');
      this.showLoginForm();
    }
  }

  showLoginForm() {
    document.body.innerHTML = `
      <div class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-8">
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-emerald-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-white mb-2">Admin Login</h1>
            <p class="text-gray-400">Enter your admin credentials</p>
          </div>
          
          <form id="adminLoginForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2 text-white">Email</label>
              <input type="email" id="adminEmail" required class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2 text-white">Password</label>
              <input type="password" id="adminPassword" required class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500">
            </div>
            <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
              Login
            </button>
          </form>
        </div>
      </div>
      
      <div id="messageContainer" class="fixed top-4 right-4 z-50 space-y-2"></div>
    `;

    // Setup login form
    const loginForm = document.getElementById('adminLoginForm');
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAdminLogin();
    });
  }

  async handleAdminLogin() {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    if (!email || !password) {
      this.showMessage('error', 'Please fill in all fields');
      return;
    }

    try {
      this.showLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
      this.showMessage('error', handleFirebaseError(error));
    } finally {
      this.showLoading(false);
    }
  }

  initializeAdminPanel() {
    // Update UI with user info
    const adminEmailEl = document.getElementById('adminEmail');
    if (adminEmailEl) {
      adminEmailEl.textContent = this.currentUser.email;
    }

    this.setupTabs();
    this.setupEventListeners();
    this.loadOrders();
    this.loadConfig();
    
    this.showMessage('success', 'Welcome to admin panel');
  }

  setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      if (content.id === tabName + 'Tab') {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });

    this.currentTab = tabName;

    // Load tab-specific data
    switch (tabName) {
      case 'orders':
        this.loadOrders();
        break;
      case 'products':
        this.loadRPSItems();
        break;
      case 'payments':
        this.loadPaymentMethods();
        break;
      case 'captcha':
        this.loadCaptchaAssets();
        break;
      case 'support':
        this.loadSupportTickets();
        this.loadKnowledgeBase();
        break;
    }
  }

  setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', async () => {
      await this.handleLogout();
    });

    // Order filters
    const statusFilter = document.getElementById('statusFilter');
    const dateFilter = document.getElementById('dateFilter');

    statusFilter?.addEventListener('change', () => {
      this.filterOrders();
    });

    dateFilter?.addEventListener('change', () => {
      this.filterOrders();
    });

    // Configuration forms
    this.setupConfigForms();

    // Modal handlers
    this.setupModals();
  }

  setupConfigForms() {
    // Website config form
    const websiteForm = document.getElementById('websiteConfigForm');
    websiteForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.updateWebsiteConfig();
    });

    // RGT pricing form
    const rgtForm = document.getElementById('rgtPricingForm');
    rgtForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.updateRGTPricing();
    });

    // Add product buttons
    const addRPSBtn = document.getElementById('addRPSItemBtn');
    addRPSBtn?.addEventListener('click', () => {
      this.showAddRPSItemModal();
    });

    const addPaymentBtn = document.getElementById('addPaymentMethodBtn');
    addPaymentBtn?.addEventListener('click', () => {
      this.showAddPaymentMethodModal();
    });
  }

  setupModals() {
    // Order details modal
    const orderModal = document.getElementById('orderModal');
    const closeOrderModal = document.getElementById('closeOrderModal');

    closeOrderModal?.addEventListener('click', () => {
      orderModal.classList.add('hidden');
    });

    orderModal?.addEventListener('click', (e) => {
      if (e.target === orderModal) {
        orderModal.classList.add('hidden');
      }
    });

    // Generic modal
    const genericModal = document.getElementById('genericModal');
    const closeGenericModal = document.getElementById('closeGenericModal');

    closeGenericModal?.addEventListener('click', () => {
      genericModal.classList.add('hidden');
    });

    genericModal?.addEventListener('click', (e) => {
      if (e.target === genericModal) {
        genericModal.classList.add('hidden');
      }
    });
  }

  async loadOrders() {
    try {
      const ordersRef = ref(shopDB, 'orders');
      const ordersQuery = query(ordersRef, limitToLast(100));
      
      // Remove existing listener
      this.listeners.forEach(unsubscribe => unsubscribe());
      this.listeners = [];

      // Set up real-time listener
      const unsubscribe = onValue(ordersQuery, (snapshot) => {
        if (snapshot.exists()) {
          this.orders = snapshot.val();
          this.displayOrders();
        } else {
          this.orders = {};
          this.displayOrders();
        }
      });
      
      this.listeners.push(unsubscribe);
    } catch (error) {
      console.error('Error loading orders:', error);
      this.showMessage('error', 'Failed to load orders');
    }
  }

  displayOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const ordersList = Object.values(this.orders).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    if (ordersList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">No orders found</td></tr>';
      return;
    }

    tbody.innerHTML = ordersList.map(order => `
      <tr class="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer" onclick="adminPanel.showOrderDetails('${order.orderId}')">
        <td class="py-3 px-2 font-mono text-sm">${order.orderId}</td>
        <td class="py-3 px-2">
          <div class="text-sm">${order.customerName}</div>
          <div class="text-xs text-gray-400">${order.growId}</div>
        </td>
        <td class="py-3 px-2">${order.category}</td>
        <td class="py-3 px-2 font-semibold">${this.formatCurrency(order.totalPrice)}</td>
        <td class="py-3 px-2">
          <span class="status-badge ${this.getStatusClass(order.status)}">${this.formatStatus(order.status)}</span>
        </td>
        <td class="py-3 px-2 text-sm">${this.formatDate(order.timestamp)}</td>
        <td class="py-3 px-2">
          <div class="flex space-x-1">
            ${order.status === 'awaiting_admin_review' ? `
              <button onclick="event.stopPropagation(); adminPanel.acceptOrder('${order.orderId}')" class="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 rounded">
                Accept
              </button>
              <button onclick="event.stopPropagation(); adminPanel.declineOrder('${order.orderId}')" class="bg-red-600 hover:bg-red-700 text-xs px-2 py-1 rounded">
                Decline
              </button>
            ` : ''}
            <button onclick="event.stopPropagation(); adminPanel.sendToTelegram('${order.orderId}')" class="bg-blue-600 hover:bg-blue-700 text-xs px-2 py-1 rounded">
              Telegram
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  filterOrders() {
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;

    let filteredOrders = Object.values(this.orders);

    if (statusFilter) {
      filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString();
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.timestamp).toDateString() === filterDate
      );
    }

    // Update display with filtered orders
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (filteredOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">No orders match the filters</td></tr>';
      return;
    }

    tbody.innerHTML = filteredOrders
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(order => `
        <tr class="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer" onclick="adminPanel.showOrderDetails('${order.orderId}')">
          <td class="py-3 px-2 font-mono text-sm">${order.orderId}</td>
          <td class="py-3 px-2">
            <div class="text-sm">${order.customerName}</div>
            <div class="text-xs text-gray-400">${order.growId}</div>
          </td>
          <td class="py-3 px-2">${order.category}</td>
          <td class="py-3 px-2 font-semibold">${this.formatCurrency(order.totalPrice)}</td>
          <td class="py-3 px-2">
            <span class="status-badge ${this.getStatusClass(order.status)}">${this.formatStatus(order.status)}</span>
          </td>
          <td class="py-3 px-2 text-sm">${this.formatDate(order.timestamp)}</td>
          <td class="py-3 px-2">
            <div class="flex space-x-1">
              ${order.status === 'awaiting_admin_review' ? `
                <button onclick="event.stopPropagation(); adminPanel.acceptOrder('${order.orderId}')" class="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 rounded">
                  Accept
                </button>
                <button onclick="event.stopPropagation(); adminPanel.declineOrder('${order.orderId}')" class="bg-red-600 hover:bg-red-700 text-xs px-2 py-1 rounded">
                  Decline
                </button>
              ` : ''}
              <button onclick="event.stopPropagation(); adminPanel.sendToTelegram('${order.orderId}')" class="bg-blue-600 hover:bg-blue-700 text-xs px-2 py-1 rounded">
                Telegram
              </button>
            </div>
          </td>
        </tr>
      `).join('');
  }

  showOrderDetails(orderId) {
    const order = this.orders[orderId];
    if (!order) return;

    const modal = document.getElementById('orderModal');
    const content = document.getElementById('orderDetailsContent');

    content.innerHTML = `
      <div class="space-y-6">
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <h4 class="font-semibold mb-2">Order Information</h4>
            <div class="space-y-2 text-sm">
              <div><span class="text-gray-400">Order ID:</span> <span class="font-mono">${order.orderId}</span></div>
              <div><span class="text-gray-400">Status:</span> <span class="status-badge ${this.getStatusClass(order.status)}">${this.formatStatus(order.status)}</span></div>
              <div><span class="text-gray-400">Category:</span> ${order.category}</div>
              <div><span class="text-gray-400">Date:</span> ${this.formatDate(order.timestamp)}</div>
            </div>
          </div>
          <div>
            <h4 class="font-semibold mb-2">Customer Details</h4>
            <div class="space-y-2 text-sm">
              <div><span class="text-gray-400">Name:</span> ${order.customerName}</div>
              <div><span class="text-gray-400">GrowID:</span> ${order.growId}</div>
              <div><span class="text-gray-400">World:</span> ${order.world}</div>
              <div><span class="text-gray-400">WhatsApp:</span> ${order.whatsappNumber}</div>
            </div>
          </div>
        </div>

        <div>
          <h4 class="font-semibold mb-2">Order Details</h4>
          <div class="bg-gray-700/50 rounded-lg p-4">
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div><span class="text-gray-400">Product:</span> ${order.purchaseType || order.itemKey}</div>
              <div><span class="text-gray-400">Quantity:</span> ${order.quantity}</div>
              <div><span class="text-gray-400">Unit Price:</span> ${this.formatCurrency(order.unitPrice)}</div>
              <div><span class="text-gray-400">Total:</span> <span class="font-semibold">${this.formatCurrency(order.totalPrice)}</span></div>
            </div>
            ${order.notes ? `<div class="mt-3"><span class="text-gray-400">Notes:</span> ${order.notes}</div>` : ''}
          </div>
        </div>

        <div>
          <h4 class="font-semibold mb-2">Payment Information</h4>
          <div class="bg-gray-700/50 rounded-lg p-4 text-sm">
            <div><span class="text-gray-400">Method:</span> ${order.paymentMethod}</div>
            <div><span class="text-gray-400">Account:</span> ${order.paymentTarget?.accountNumber} (${order.paymentTarget?.accountName})</div>
            ${order.proofUrl ? `
              <div class="mt-3">
                <span class="text-gray-400">Payment Proof:</span><br>
                <img src="${order.proofUrl}" alt="Payment proof" class="max-w-xs rounded border mt-2">
              </div>
            ` : ''}
          </div>
        </div>

        ${order.status === 'awaiting_admin_review' ? `
          <div class="flex space-x-4">
            <button onclick="adminPanel.acceptOrder('${order.orderId}')" class="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold">
              Accept Order
            </button>
            <button onclick="adminPanel.declineOrder('${order.orderId}')" class="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold">
              Decline Order
            </button>
          </div>
        ` : ''}
      </div>
    `;

    modal.classList.remove('hidden');
  }

  async acceptOrder(orderId) {
    try {
      this.showLoading(true);
      
      const order = this.orders[orderId];
      if (!order) throw new Error('Order not found');

      const updateData = {
        status: 'PESANAN SUDAH DI PROSES',
        acceptedBy: this.currentUser.uid,
        acceptedAt: new Date().toISOString(),
        statusHistory: [
          ...(order.statusHistory || []),
          {
            status: 'PESANAN SUDAH DI PROSES',
            timestamp: new Date().toISOString(),
            adminId: this.currentUser.uid,
            note: 'Order accepted by admin'
          }
        ]
      };

      const orderRef = ref(shopDB, `orders/${orderId}`);
      await update(orderRef, updateData);

      // Send notification to Telegram
      await this.sendTelegramNotification(orderId, 'accepted');

      this.showMessage('success', 'Order accepted successfully');
      
      // Close modal if open
      const modal = document.getElementById('orderModal');
      modal.classList.add('hidden');

    } catch (error) {
      console.error('Error accepting order:', error);
      this.showMessage('error', 'Failed to accept order');
    } finally {
      this.showLoading(false);
    }
  }

  async declineOrder(orderId) {
    const reason = prompt('Please enter decline reason:');
    if (!reason) return;

    try {
      this.showLoading(true);
      
      const order = this.orders[orderId];
      if (!order) throw new Error('Order not found');

      const updateData = {
        status: 'PESANAN DI TOLAK',
        declinedBy: this.currentUser.uid,
        declinedAt: new Date().toISOString(),
        declineReason: reason,
        statusHistory: [
          ...(order.statusHistory || []),
          {
            status: 'PESANAN DI TOLAK',
            timestamp: new Date().toISOString(),
            adminId: this.currentUser.uid,
            note: `Order declined: ${reason}`
          }
        ]
      };

      const orderRef = ref(shopDB, `orders/${orderId}`);
      await update(orderRef, updateData);

      // Send notification to Telegram
      await this.sendTelegramNotification(orderId, 'declined', reason);

      this.showMessage('success', 'Order declined');
      
      // Close modal if open
      const modal = document.getElementById('orderModal');
      modal.classList.add('hidden');

    } catch (error) {
      console.error('Error declining order:', error);
      this.showMessage('error', 'Failed to decline order');
    } finally {
      this.showLoading(false);
    }
  }

  async sendToTelegram(orderId) {
    try {
      const order = this.orders[orderId];
      if (!order) throw new Error('Order not found');

      await this.sendTelegramNotification(orderId, 'review');
      this.showMessage('success', 'Notification sent to Telegram');
    } catch (error) {
      console.error('Error sending to Telegram:', error);
      this.showMessage('error', 'Failed to send Telegram notification');
    }
  }

  async sendTelegramNotification(orderId, action, reason = '') {
    try {
      // This would call a Cloud Function to send the Telegram message
      const response = await fetch('/api/admin-telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          orderId,
          action,
          reason,
          adminId: this.currentUser.uid
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send Telegram notification');
      }
    } catch (error) {
      console.error('Telegram notification error:', error);
      // Don't throw - this is non-critical
    }
  }

  async loadConfig() {
    try {
      const configRef = ref(shopDB, 'config');
      const snapshot = await get(configRef);
      
      if (snapshot.exists()) {
        const config = snapshot.val();
        
        // Update form fields
        const websiteName = document.getElementById('websiteName');
        const feePercent = document.getElementById('feePercent');
        const dlPrice = document.getElementById('dlPrice');
        const bglPrice = document.getElementById('bglPrice');

        if (websiteName) websiteName.value = config.website_name || '';
        if (feePercent) feePercent.value = config.fee_percent || 0;
        if (dlPrice) dlPrice.value = config.prices?.rgt?.dl || 0;
        if (bglPrice) bglPrice.value = config.prices?.rgt?.bgl || 0;
      }
    } catch (error) {
      console.error('Error loading config:', error);
      this.showMessage('error', 'Failed to load configuration');
    }
  }

  async updateWebsiteConfig() {
    try {
      this.showLoading(true);
      
      const websiteName = document.getElementById('websiteName').value;
      const feePercent = parseFloat(document.getElementById('feePercent').value) || 0;

      const updates = {
        'config/website_name': sanitizeInput(websiteName),
        'config/fee_percent': feePercent
      };

      await update(ref(shopDB), updates);
      
      this.showMessage('success', 'Website configuration updated');
    } catch (error) {
      console.error('Error updating config:', error);
      this.showMessage('error', 'Failed to update configuration');
    } finally {
      this.showLoading(false);
    }
  }

  async updateRGTPricing() {
    try {
      this.showLoading(true);
      
      const dlPrice = parseFloat(document.getElementById('dlPrice').value) || 0;
      const bglPrice = parseFloat(document.getElementById('bglPrice').value) || 0;

      const updates = {
        'config/prices/rgt/dl': dlPrice,
        'config/prices/rgt/bgl': bglPrice
      };

      await update(ref(shopDB), updates);
      
      this.showMessage('success', 'RGT prices updated');
    } catch (error) {
      console.error('Error updating prices:', error);
      this.showMessage('error', 'Failed to update prices');
    } finally {
      this.showLoading(false);
    }
  }

  // Utility methods
  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatStatus(status) {
    const statusMap = {
      'pending_confirmation': 'Pending',
      'awaiting_admin_review': 'Under Review',
      'PESANAN SUDAH DI PROSES': 'Processed',
      'PESANAN DI TOLAK': 'Declined'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status) {
    const classMap = {
      'pending_confirmation': 'status-pending',
      'awaiting_admin_review': 'status-review',
      'PESANAN SUDAH DI PROSES': 'status-processed',
      'PESANAN DI TOLAK': 'status-declined'
    };
    return classMap[status] || 'status-pending';
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

    setTimeout(() => {
      messageEl.remove();
    }, 5000);
  }

  async handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      this.showMessage('error', 'Error logging out');
    }
  }

  // Placeholder methods for additional functionality
  async loadRPSItems() {
    // Implementation for RPS items management
    console.log('Loading RPS items...');
  }

  async loadPaymentMethods() {
    // Implementation for payment methods management
    console.log('Loading payment methods...');
  }

  async loadCaptchaAssets() {
    // Implementation for captcha management
    console.log('Loading captcha assets...');
  }

  async loadSupportTickets() {
    // Implementation for support tickets
    console.log('Loading support tickets...');
  }

  async loadKnowledgeBase() {
    // Implementation for knowledge base management
    console.log('Loading knowledge base...');
  }

  showAddRPSItemModal() {
    // Implementation for RPS item modal
    console.log('Show add RPS item modal');
  }

  showAddPaymentMethodModal() {
    // Implementation for payment method modal
    console.log('Show add payment method modal');
  }
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Make it available globally for onclick handlers
window.adminPanel = adminPanel;
