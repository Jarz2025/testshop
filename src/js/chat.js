// Customer service chat module with AI integration
import { ref, push, set, get, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';
import { shopDB, handleFirebaseError, sanitizeInput, checkRateLimit } from './firebase.js';
import authManager from './auth.js';
import i18n from './i18n.js';

class CustomerServiceChat {
  constructor() {
    this.isOpen = false;
    this.currentSession = null;
    this.messages = [];
    this.isConnected = false;
    this.knowledgeBase = [];
    this.init();
  }

  async init() {
    this.setupChatUI();
    await this.loadKnowledgeBase();
  }

  setupChatUI() {
    const chatBtn = document.getElementById('customerServiceBtn');
    const chatModal = document.getElementById('chatModal');
    const closeChatBtn = document.getElementById('closeChatModal');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');

    // Open chat modal
    chatBtn?.addEventListener('click', () => {
      this.openChat();
    });

    // Close chat modal
    closeChatBtn?.addEventListener('click', () => {
      this.closeChat();
    });

    // Close on backdrop click
    chatModal?.addEventListener('click', (e) => {
      if (e.target === chatModal) {
        this.closeChat();
      }
    });

    // Send message on enter
    chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send button click
    sendBtn?.addEventListener('click', () => {
      this.sendMessage();
    });
  }

  async loadKnowledgeBase() {
    try {
      const kbRef = ref(shopDB, 'kb');
      const snapshot = await get(kbRef);
      
      if (snapshot.exists()) {
        this.knowledgeBase = Object.values(snapshot.val());
      } else {
        // Initialize default knowledge base
        await this.initializeDefaultKB();
      }
    } catch (error) {
      console.warn('Could not load knowledge base:', error);
      this.loadDefaultKnowledgeBase();
    }
  }

  loadDefaultKnowledgeBase() {
    this.knowledgeBase = [
      {
        id: 'payment_methods',
        question: 'What payment methods do you accept?',
        answer: 'We accept DANA, GoPay, and other major Indonesian e-wallets. You can see all available payment methods when placing an order.',
        keywords: ['payment', 'method', 'dana', 'gopay', 'ewallet', 'transfer'],
        category: 'payment'
      },
      {
        id: 'delivery_time',
        question: 'How long does delivery take?',
        answer: 'RGT orders (Diamond Locks/Blue Gem Locks) are usually processed within 5-15 minutes after payment confirmation. RPS items may take 30 minutes to 2 hours depending on availability.',
        keywords: ['delivery', 'time', 'fast', 'how long', 'process', 'speed'],
        category: 'delivery'
      },
      {
        id: 'order_status',
        question: 'How can I check my order status?',
        answer: 'After placing an order, you will receive updates via WhatsApp. You can also check your order history in your account dashboard.',
        keywords: ['order', 'status', 'check', 'track', 'progress'],
        category: 'orders'
      },
      {
        id: 'refund_policy',
        question: 'What is your refund policy?',
        answer: 'Refunds are available if we cannot deliver your order within 24 hours, or if there is an error on our part. Digital items cannot be refunded once delivered.',
        keywords: ['refund', 'return', 'money back', 'cancel', 'policy'],
        category: 'policy'
      },
      {
        id: 'world_security',
        question: 'Is my world and GrowID safe?',
        answer: 'Yes, we only need your world name and GrowID for delivery. We never ask for your password and all transactions are secure.',
        keywords: ['safe', 'secure', 'password', 'hack', 'security', 'trust'],
        category: 'security'
      },
      {
        id: 'minimum_order',
        question: 'Is there a minimum order amount?',
        answer: 'No minimum order! You can order as little as 1 Diamond Lock or any single RPS item.',
        keywords: ['minimum', 'order', 'small', 'little', 'single'],
        category: 'orders'
      }
    ];
  }

  async initializeDefaultKB() {
    try {
      const kbRef = ref(shopDB, 'kb');
      const kbData = {};
      
      this.loadDefaultKnowledgeBase();
      this.knowledgeBase.forEach((item, index) => {
        kbData[item.id] = item;
      });
      
      await set(kbRef, kbData);
    } catch (error) {
      console.error('Error initializing knowledge base:', error);
    }
  }

  async openChat() {
    if (!authManager.isAuthenticated()) {
      authManager.showMessage('warning', 'Please login to start a chat');
      authManager.showAuthModal();
      return;
    }

    const chatModal = document.getElementById('chatModal');
    chatModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    this.isOpen = true;
    
    // Initialize or resume session
    await this.initializeSession();
  }

  closeChat() {
    const chatModal = document.getElementById('chatModal');
    chatModal?.classList.add('hidden');
    document.body.style.overflow = '';
    
    this.isOpen = false;
    
    // Save session state
    this.saveSession();
  }

  async initializeSession() {
    const user = authManager.getCurrentUser();
    if (!user) return;

    try {
      // Check for existing session
      const sessionRef = ref(shopDB, `cs_sessions/${user.uid}`);
      const snapshot = await get(sessionRef);
      
      if (snapshot.exists()) {
        this.currentSession = snapshot.val();
        this.messages = this.currentSession.messages || [];
      } else {
        // Create new session
        this.currentSession = {
          userId: user.uid,
          userEmail: user.email,
          startTime: new Date().toISOString(),
          messages: [],
          status: 'active',
          language: i18n.getCurrentLanguage()
        };
        
        // Send welcome message
        await this.addBotMessage(i18n.t('chat.welcome'));
      }
      
      // Display existing messages
      this.displayMessages();
      this.isConnected = true;
      
    } catch (error) {
      console.error('Error initializing chat session:', error);
      this.showChatError('Failed to connect to support. Please try again.');
    }
  }

  async sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput?.value.trim();
    
    if (!message || !this.isConnected) return;

    // Rate limiting
    const user = authManager.getCurrentUser();
    if (!checkRateLimit(`chat:${user.uid}`, 20, 60000)) { // 20 messages per minute
      this.showChatError('Too many messages. Please slow down.');
      return;
    }

    try {
      // Clear input
      if (chatInput) chatInput.value = '';
      
      // Add user message
      await this.addUserMessage(message);
      
      // Show typing indicator
      this.showTypingIndicator();
      
      // Process message with AI
      setTimeout(async () => {
        await this.processMessage(message);
        this.hideTypingIndicator();
      }, 1000);
      
    } catch (error) {
      console.error('Error sending message:', error);
      this.showChatError('Failed to send message. Please try again.');
    }
  }

  async addUserMessage(text) {
    const message = {
      id: Date.now().toString(),
      text: sanitizeInput(text),
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    this.messages.push(message);
    this.currentSession.messages = this.messages;
    
    this.displayMessage(message);
    await this.saveSession();
  }

  async addBotMessage(text) {
    const message = {
      id: Date.now().toString(),
      text: text,
      sender: 'bot',
      timestamp: new Date().toISOString()
    };
    
    this.messages.push(message);
    this.currentSession.messages = this.messages;
    
    this.displayMessage(message);
    await this.saveSession();
  }

  displayMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    this.messages.forEach(message => {
      this.displayMessage(message);
    });
    
    this.scrollToBottom();
  }

  displayMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.sender}`;
    messageEl.innerHTML = `
      <div class="text-sm">${message.text}</div>
      <div class="text-xs opacity-60 mt-1">${this.formatMessageTime(message.timestamp)}</div>
    `;
    
    messagesContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.className = 'chat-message bot';
    indicator.innerHTML = '<div class="text-sm loading-dots">AI is typing</div>';
    
    messagesContainer.appendChild(indicator);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    indicator?.remove();
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  async processMessage(userMessage) {
    try {
      // First, try to find answer in knowledge base
      const kbResponse = this.searchKnowledgeBase(userMessage);
      
      if (kbResponse.confidence > 0.7) {
        // High confidence KB match
        await this.addBotMessage(kbResponse.answer);
        
        // Optionally add follow-up questions
        if (kbResponse.followUp) {
          setTimeout(async () => {
            await this.addBotMessage(kbResponse.followUp);
          }, 1500);
        }
      } else if (kbResponse.confidence > 0.4) {
        // Medium confidence - ask for clarification
        await this.addBotMessage(`I think you're asking about ${kbResponse.category}. ${kbResponse.answer}`);
        await this.addBotMessage("Is this what you were looking for? If not, please provide more details.");
      } else {
        // Low confidence - use AI or escalate to human
        const aiResponse = await this.getAIResponse(userMessage);
        await this.addBotMessage(aiResponse);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      await this.addBotMessage("I'm having trouble understanding. Let me connect you with a human agent.");
      await this.escalateToHuman();
    }
  }

  searchKnowledgeBase(query) {
    const queryLower = query.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    this.knowledgeBase.forEach(item => {
      let score = 0;
      
      // Check keywords
      item.keywords.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 0.2;
        }
      });
      
      // Check question similarity
      const questionWords = item.question.toLowerCase().split(' ');
      const queryWords = queryLower.split(' ');
      
      queryWords.forEach(word => {
        if (word.length > 2 && questionWords.some(qw => qw.includes(word))) {
          score += 0.1;
        }
      });
      
      // Check exact matches in answer
      if (item.answer.toLowerCase().includes(queryLower)) {
        score += 0.3;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    });

    return {
      answer: bestMatch ? bestMatch.answer : "I'm not sure about that. Let me check with a human agent.",
      confidence: bestScore,
      category: bestMatch ? bestMatch.category : 'general',
      followUp: this.getFollowUpQuestion(bestMatch)
    };
  }

  getFollowUpQuestion(kbItem) {
    if (!kbItem) return null;
    
    const followUps = {
      payment: "Do you have any other questions about payments or pricing?",
      delivery: "Would you like to know about our delivery process for specific items?",
      orders: "Do you need help with placing an order or have other order-related questions?",
      security: "Are there any other security concerns I can help address?",
      policy: "Do you have questions about our other policies or terms?"
    };
    
    return followUps[kbItem.category] || "Is there anything else I can help you with?";
  }

  async getAIResponse(message) {
    try {
      // This would integrate with an AI service like OpenAI
      // For now, return a helpful fallback response
      
      const context = this.buildContextFromSession();
      
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return contextual response based on message content
      if (message.toLowerCase().includes('price') || message.toLowerCase().includes('cost')) {
        return "Our prices are competitive and updated regularly. Diamond Locks start from 35,000 IDR. You can see current prices when placing an order. Would you like help with a specific item?";
      }
      
      if (message.toLowerCase().includes('order') || message.toLowerCase().includes('buy')) {
        return "I can help you place an order! Simply select RGT or RPS from the main page, fill out the form, and follow the payment instructions. Do you need help with a specific step?";
      }
      
      if (message.toLowerCase().includes('problem') || message.toLowerCase().includes('issue')) {
        return "I'm sorry you're experiencing issues. Can you please describe the specific problem you're facing? This will help me provide better assistance or connect you with the right person.";
      }
      
      return "I understand you need help, but I'm not sure about the specifics. Let me connect you with a human agent who can provide more detailed assistance.";
      
    } catch (error) {
      console.error('AI response error:', error);
      return "I'm experiencing technical difficulties. Let me connect you with a human agent.";
    }
  }

  buildContextFromSession() {
    // Build context from recent messages and user info
    const user = authManager.getCurrentUser();
    const recentMessages = this.messages.slice(-10); // Last 10 messages
    
    return {
      userId: user?.uid,
      userEmail: user?.email,
      language: i18n.getCurrentLanguage(),
      recentMessages: recentMessages,
      sessionDuration: Date.now() - new Date(this.currentSession?.startTime).getTime()
    };
  }

  async escalateToHuman() {
    try {
      // Create support ticket
      const user = authManager.getCurrentUser();
      const ticketRef = push(ref(shopDB, 'tickets'));
      
      await set(ticketRef, {
        id: ticketRef.key,
        userId: user.uid,
        userEmail: user.email,
        subject: 'Chat Support Request',
        messages: this.messages,
        status: 'open',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        language: i18n.getCurrentLanguage()
      });
      
      // Update session status
      this.currentSession.status = 'escalated';
      this.currentSession.ticketId = ticketRef.key;
      await this.saveSession();
      
      // Notify admin (would trigger Cloud Function)
      this.notifyAdminOfTicket(ticketRef.key);
      
      await this.addBotMessage("I've created a support ticket for you and notified our human agents. Someone will respond to you as soon as possible. Your ticket ID is: " + ticketRef.key);
      
    } catch (error) {
      console.error('Error escalating to human:', error);
      await this.addBotMessage("I'm having trouble creating a support ticket. Please contact us directly via WhatsApp or email for immediate assistance.");
    }
  }

  async notifyAdminOfTicket(ticketId) {
    try {
      // This would call a Cloud Function to send notification
      await fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_ticket',
          ticketId: ticketId
        })
      });
    } catch (error) {
      console.warn('Could not notify admin of ticket:', error);
    }
  }

  async saveSession() {
    if (!this.currentSession) return;
    
    try {
      const user = authManager.getCurrentUser();
      if (!user) return;
      
      const sessionRef = ref(shopDB, `cs_sessions/${user.uid}`);
      await set(sessionRef, {
        ...this.currentSession,
        lastActivity: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }

  formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  showChatError(message) {
    if (window.authManager && typeof window.authManager.showMessage === 'function') {
      window.authManager.showMessage('error', message);
    } else {
      console.error('Chat Error:', message);
    }
  }

  // Public methods
  isConnected() {
    return this.isConnected;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  // Admin methods for managing knowledge base
  async addKnowledgeBaseItem(item) {
    try {
      const kbRef = ref(shopDB, `kb/${item.id}`);
      await set(kbRef, item);
      
      // Update local cache
      const existingIndex = this.knowledgeBase.findIndex(kb => kb.id === item.id);
      if (existingIndex >= 0) {
        this.knowledgeBase[existingIndex] = item;
      } else {
        this.knowledgeBase.push(item);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error adding KB item:', error);
      return { success: false, error: error.message };
    }
  }

  async removeKnowledgeBaseItem(itemId) {
    try {
      const kbRef = ref(shopDB, `kb/${itemId}`);
      await set(kbRef, null);
      
      // Update local cache
      this.knowledgeBase = this.knowledgeBase.filter(item => item.id !== itemId);
      
      return { success: true };
    } catch (error) {
      console.error('Error removing KB item:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global chat instance
const customerServiceChat = new CustomerServiceChat();

// Export for use in other modules
export default customerServiceChat;

// Also make it available globally
window.customerServiceChat = customerServiceChat;
