const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

// Initialize Firebase Admin
admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = functions.config().telegram?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = functions.config().telegram?.admin_chat_id || process.env.ADMIN_CHAT_ID;

// Cloud Function to verify captcha
exports.verifyCaptcha = functions.https.onCall(async (data, context) => {
  try {
    const { captchaId, answer } = data;
    
    if (!captchaId || !answer) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    // Get captcha data from database
    const captchaRef = admin.database().ref(`config/captcha_list/${captchaId}`);
    const snapshot = await captchaRef.once('value');
    
    if (!snapshot.exists()) {
      throw new functions.https.HttpsError('not-found', 'Invalid captcha ID');
    }

    const captchaData = snapshot.val();
    
    // Simple hash verification (in production, use better hashing)
    const hashedAnswer = hashString(answer.toLowerCase().trim());
    
    if (hashedAnswer === captchaData.answerHash) {
      return { 
        success: true, 
        token: generateCaptchaToken(captchaId) 
      };
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid captcha answer');
    }
  } catch (error) {
    console.error('Captcha verification error:', error);
    throw new functions.https.HttpsError('internal', 'Captcha verification failed');
  }
});

// Cloud Function to send Telegram notifications
exports.sendTelegramNotification = functions.https.onCall(async (data, context) => {
  // Verify admin authentication
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
  }

  try {
    const { orderId, action, reason } = data;
    
    // Get order details
    const orderRef = admin.database().ref(`orders/${orderId}`);
    const orderSnapshot = await orderRef.once('value');
    
    if (!orderSnapshot.exists()) {
      throw new functions.https.HttpsError('not-found', 'Order not found');
    }

    const order = orderSnapshot.val();
    
    let message = '';
    let buttons = [];

    switch (action) {
      case 'proof_uploaded':
        message = `🔔 New Payment Proof Uploaded\n\n` +
                 `📋 Order: ${order.orderId}\n` +
                 `🎮 Game: Growtopia\n` +
                 `📦 Category: ${order.category}\n` +
                 `👤 GrowID: ${order.growId}\n` +
                 `🌍 World: ${order.world}\n` +
                 `💰 Amount: ${formatCurrency(order.totalPrice)}\n` +
                 `👨‍💼 Buyer: ${order.buyerEmail}\n\n` +
                 `Click Accept or Decline below.`;
        
        buttons = [
          [
            { text: 'Accept', callback_data: `order:accept:${orderId}` },
            { text: 'Decline', callback_data: `order:decline:${orderId}` }
          ]
        ];
        break;

      case 'accepted':
        message = `✅ Order Accepted\n\n` +
                 `📋 Order: ${order.orderId}\n` +
                 `Status: PESANAN SUDAH DI PROSES\n` +
                 `Accepted by: ${context.auth.token.email}`;
        break;

      case 'declined':
        message = `❌ Order Declined\n\n` +
                 `📋 Order: ${order.orderId}\n` +
                 `Status: PESANAN DI TOLAK\n` +
                 `Reason: ${reason}\n` +
                 `Declined by: ${context.auth.token.email}`;
        break;

      default:
        message = `📋 Order Update: ${orderId}\n` +
                 `Status: ${order.status}`;
    }

    // Send to Telegram
    await sendTelegramMessage(message, buttons, order.proofUrl);
    
    return { success: true };
  } catch (error) {
    console.error('Telegram notification error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});

// Telegram webhook handler
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const update = req.body;
    
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle Telegram callback queries (Accept/Decline buttons)
async function handleCallbackQuery(callbackQuery) {
  const { data, from, message } = callbackQuery;
  const [action, operation, orderId] = data.split(':');
  
  if (action !== 'order' || !['accept', 'decline'].includes(operation)) {
    return;
  }

  try {
    // Verify admin user
    const adminRef = admin.database().ref(`admins`);
    const adminSnapshot = await adminRef.once('value');
    const admins = adminSnapshot.val() || {};
    
    const isAdmin = Object.values(admins).some(admin => 
      admin.telegramId === from.id.toString() && admin.isAdmin
    );
    
    if (!isAdmin) {
      await answerCallbackQuery(callbackQuery.id, 'Access denied. Admin privileges required.');
      return;
    }

    // Get order
    const orderRef = admin.database().ref(`orders/${orderId}`);
    const orderSnapshot = await orderRef.once('value');
    
    if (!orderSnapshot.exists()) {
      await answerCallbackQuery(callbackQuery.id, 'Order not found');
      return;
    }

    const order = orderSnapshot.val();
    
    if (order.status !== 'awaiting_admin_review') {
      await answerCallbackQuery(callbackQuery.id, 'Order already processed');
      return;
    }

    // Update order status
    let updateData;
    let responseMessage;
    
    if (operation === 'accept') {
      updateData = {
        status: 'PESANAN SUDAH DI PROSES',
        acceptedBy: from.id.toString(),
        acceptedAt: admin.database.ServerValue.TIMESTAMP,
        statusHistory: [
          ...(order.statusHistory || []),
          {
            status: 'PESANAN SUDAH DI PROSES',
            timestamp: new Date().toISOString(),
            adminTelegramId: from.id.toString(),
            note: 'Order accepted via Telegram'
          }
        ]
      };
      responseMessage = '✅ Order accepted successfully';
    } else {
      updateData = {
        status: 'PESANAN DI TOLAK',
        declinedBy: from.id.toString(),
        declinedAt: admin.database.ServerValue.TIMESTAMP,
        declineReason: 'Declined via Telegram',
        statusHistory: [
          ...(order.statusHistory || []),
          {
            status: 'PESANAN DI TOLAK',
            timestamp: new Date().toISOString(),
            adminTelegramId: from.id.toString(),
            note: 'Order declined via Telegram'
          }
        ]
      };
      responseMessage = '❌ Order declined';
    }

    await orderRef.update(updateData);
    
    // Update the message to remove buttons
    const updatedMessage = message.text + `\n\n${responseMessage}`;
    await editTelegramMessage(message.chat.id, message.message_id, updatedMessage);
    
    await answerCallbackQuery(callbackQuery.id, responseMessage);
    
  } catch (error) {
    console.error('Callback query error:', error);
    await answerCallbackQuery(callbackQuery.id, 'Error processing request');
  }
}

// Telegram API helpers
async function sendTelegramMessage(text, inlineKeyboard = [], photoUrl = null) {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.warn('Telegram configuration missing');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: ADMIN_CHAT_ID,
    text: text,
    parse_mode: 'HTML'
  };

  if (inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: inlineKeyboard
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }

    // If there's a photo, send it as well
    if (photoUrl) {
      await sendTelegramPhoto(photoUrl, 'Payment Proof');
    }

    return await response.json();
  } catch (error) {
    console.error('Telegram send message error:', error);
    throw error;
  }
}

async function sendTelegramPhoto(photoUrl, caption = '') {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) return;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  
  const payload = {
    chat_id: ADMIN_CHAT_ID,
    photo: photoUrl,
    caption: caption
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  } catch (error) {
    console.error('Telegram send photo error:', error);
  }
}

async function editTelegramMessage(chatId, messageId, text) {
  if (!TELEGRAM_BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
  
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'HTML'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  } catch (error) {
    console.error('Telegram edit message error:', error);
  }
}

async function answerCallbackQuery(callbackQueryId, text) {
  if (!TELEGRAM_BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  
  const payload = {
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: true
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  } catch (error) {
    console.error('Telegram answer callback error:', error);
  }
}

// AI Chat Function
exports.processChatMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
  }

  try {
    const { message, sessionId } = data;
    
    // Rate limiting
    const rateLimitRef = admin.database().ref(`rate_limits/chat/${context.auth.uid}`);
    const rateLimitSnapshot = await rateLimitRef.once('value');
    const rateLimitData = rateLimitSnapshot.val() || { count: 0, resetAt: 0 };
    
    const now = Date.now();
    if (rateLimitData.resetAt < now) {
      // Reset rate limit window
      rateLimitData.count = 0;
      rateLimitData.resetAt = now + 60000; // 1 minute window
    }
    
    if (rateLimitData.count >= 20) {
      throw new functions.https.HttpsError('resource-exhausted', 'Too many messages. Please slow down.');
    }
    
    rateLimitData.count++;
    await rateLimitRef.set(rateLimitData);

    // Process message with knowledge base
    const kbRef = admin.database().ref('kb');
    const kbSnapshot = await kbRef.once('value');
    const knowledgeBase = Object.values(kbSnapshot.val() || {});
    
    const response = await processMessageWithKB(message, knowledgeBase, context.auth.uid);
    
    // Save to session
    const sessionRef = admin.database().ref(`cs_sessions/${context.auth.uid}/messages`);
    await sessionRef.push({
      text: message,
      sender: 'user',
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    
    await sessionRef.push({
      text: response,
      sender: 'bot',
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    
    return { response };
  } catch (error) {
    console.error('Chat processing error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to process message');
  }
});

// Simple knowledge base search
async function processMessageWithKB(message, knowledgeBase, userId) {
  const messageLower = message.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  knowledgeBase.forEach(item => {
    let score = 0;
    
    // Check keywords
    if (item.keywords) {
      item.keywords.forEach(keyword => {
        if (messageLower.includes(keyword.toLowerCase())) {
          score += 0.2;
        }
      });
    }
    
    // Check question similarity
    if (item.question) {
      const questionWords = item.question.toLowerCase().split(' ');
      const messageWords = messageLower.split(' ');
      
      messageWords.forEach(word => {
        if (word.length > 2 && questionWords.some(qw => qw.includes(word))) {
          score += 0.1;
        }
      });
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  });

  if (bestScore > 0.3 && bestMatch) {
    return bestMatch.answer;
  } else {
    // Default responses for common queries
    if (messageLower.includes('price') || messageLower.includes('cost')) {
      return "Our prices are competitive and updated regularly. Diamond Locks start from 35,000 IDR. You can see current prices when placing an order. Would you like help with a specific item?";
    }
    
    if (messageLower.includes('order') || messageLower.includes('buy')) {
      return "I can help you place an order! Simply select RGT or RPS from the main page, fill out the form, and follow the payment instructions. Do you need help with a specific step?";
    }
    
    return "I understand you need help. Let me connect you with a human agent who can provide more detailed assistance. Creating support ticket...";
  }
}

// Utility functions
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

function generateCaptchaToken(captchaId) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${captchaId}-${timestamp}-${randomStr}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}
