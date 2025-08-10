# Growtopia PPOB Shop - Complete System

A production-ready PPOB (Pay Point Online Banking) shop system specifically designed for Growtopia, featuring RGT (Diamond Locks/Blue Gem Locks) and RPS (custom items) services with comprehensive admin management, Telegram bot integration, and AI-powered customer support.

## 🏗️ System Architecture

### Dual Firebase Project Setup
- **Project A (Auth)**: User authentication, profiles, and financial transaction history
- **Project B (Shop)**: Public site configuration, orders, and admin management

### Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), TailwindCSS
- **Backend**: Firebase Realtime Database, Cloud Functions, Storage
- **Authentication**: Firebase Auth (Project A)
- **Payment Processing**: Manual proof upload system
- **Admin Notifications**: Telegram Bot with inline buttons
- **Customer Support**: AI-powered chat with knowledge base
- **Deployment**: Firebase Hosting

## 🚀 Features

### Core Shop Features
- **Dual Product Categories**: RGT (Diamond Locks, Blue Gem Locks) and RPS (custom items)
- **Dynamic Pricing**: Admin-configurable prices with real-time updates
- **Multi-language Support**: English and Indonesian with admin-editable translations
- **Mobile-First Design**: Responsive, accessible interface with dark/light themes
- **Real-time Order Tracking**: Live status updates via Firebase listeners

### Security & Validation
- **Manual Captcha System**: 100 configurable captcha images with server-side validation
- **Input Sanitization**: All user inputs are sanitized and validated
- **Rate Limiting**: Prevents spam and abuse across all endpoints
- **Secure File Upload**: Payment proofs with size/type validation and secure storage
- **Row Level Security**: Comprehensive database and storage security rules

### Admin Management
- **Real-time Order Dashboard**: Live order monitoring with filters and search
- **Configuration Management**: Website settings, pricing, payment methods
- **Product Management**: Add/edit/remove RPS items with multilingual support
- **Captcha Management**: Upload and manage captcha assets
- **Support System**: Knowledge base and ticket management

### Telegram Integration
- **Webhook Notifications**: Automatic admin notifications for new payment proofs
- **Inline Button Actions**: Accept/decline orders directly from Telegram
- **Real-time Status Sync**: Telegram actions instantly update the admin dashboard
- **Secure Verification**: Admin privilege verification for all Telegram interactions

### AI Customer Support
- **Knowledge Base Search**: Intelligent query matching with confidence scoring
- **Context-Aware Responses**: Session-based conversation context
- **Human Escalation**: Automatic ticket creation for complex queries
- **Multi-language Support**: Responses in user's preferred language

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- Firebase CLI
- Two Firebase projects (Auth + Shop)
- Telegram Bot Token

### 1. Firebase Projects Setup

#### Project A (Authentication & User Data)
```bash
# Create Firebase project for authentication
firebase projects:create growtopia-auth

# Initialize project
firebase init --project growtopia-auth
# Select: Authentication, Realtime Database
```

#### Project B (Shop Data)
```bash
# Create Firebase project for shop
firebase projects:create growtopia-shop

# Initialize project  
firebase init --project growtopia-shop
# Select: Hosting, Functions, Realtime Database, Storage
```

### 2. Environment Configuration

Create `.env` file in functions directory:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ADMIN_CHAT_ID=your_telegram_chat_id
```

Update Firebase configuration in `src/js/firebase.js`:
```javascript
// Replace with your actual Firebase configs
const firebaseConfigShop = {
  apiKey: "your-shop-api-key",
  authDomain: "growtopia-shop.firebaseapp.com",
  databaseURL: "https://growtopia-shop-default-rtdb.firebaseio.com",
  projectId: "growtopia-shop",
  storageBucket: "growtopia-shop.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const firebaseConfigAuth = {
  apiKey: "your-auth-api-key", 
  authDomain: "growtopia-auth.firebaseapp.com",
  databaseURL: "https://growtopia-auth-default-rtdb.firebaseio.com",
  projectId: "growtopia-auth",
  storageBucket: "growtopia-auth.appspot.com",
  messagingSenderId: "987654321",
  appId: "1:987654321:web:fedcba654321"
};
```

### 3. Database Setup

Deploy security rules:
```bash
firebase deploy --only database:rules
firebase deploy --only storage:rules
```

Initialize sample data in Project B:
```json
{
  "config": {
    "website_name": "Growtopia Shop",
    "prices": {
      "rgt": {
        "dl": 35000,
        "bgl": 70000
      }
    },
    "rps_items": [
      {
        "key": "MPS",
        "label_en": "Magic Pickaxe Seed",
        "label_id": "Magic Pickaxe Seed", 
        "price": 50000
      }
    ],
    "payment_methods": {
      "dana": {
        "providerLabel": "DANA",
        "accountNumber": "081234567890",
        "accountName": "GT SHOP",
        "instructions": "Transfer to DANA number above, then upload proof"
      }
    }
  },
  "admins": {
    "YOUR_ADMIN_UID": {
      "isAdmin": true,
      "email": "admin@example.com",
      "telegramId": "your_telegram_id"
    }
  }
}
```

### 4. Telegram Bot Setup

1. Create bot via @BotFather
2. Set webhook URL:
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-functions-url/telegramWebhook"}'
```

### 5. Deploy Application

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Build and deploy
npm run build
firebase deploy
```

## 🎯 Usage Guide

### Customer Flow
1. **Browse Products**: Select RGT or RPS category
2. **Fill Order Form**: Enter world name, GrowID, customer details
3. **Solve Captcha**: Verify human interaction
4. **Select Payment**: Choose from available payment methods  
5. **Upload Proof**: Submit payment screenshot
6. **Track Order**: Receive real-time status updates

### Admin Workflow
1. **Monitor Dashboard**: View real-time order list with filters
2. **Telegram Notifications**: Receive instant alerts for new payment proofs
3. **Review & Action**: Accept/decline orders via Telegram or admin panel
4. **Configuration**: Manage prices, products, and payment methods
5. **Customer Support**: Handle support tickets and manage knowledge base

## 🔧 Configuration Management

### Website Settings
- **Website Name**: Displayed in header and page title
- **Fee Percentage**: Additional processing fee (optional)
- **Maximum Quantities**: Per-category order limits

### Product Management
- **RGT Pricing**: Diamond Lock and Blue Gem Lock prices
- **RPS Items**: Add/edit custom items with multilingual names
- **Stock Control**: Enable/disable items based on availability

### Payment Methods
- **Multiple Providers**: DANA, GoPay, Bank Transfer, etc.
- **Account Details**: Secure storage of payment account information
- **QR Codes**: Optional QR code images for easy payment
- **Custom Instructions**: Tailored payment instructions per method

### Captcha System
- **Manual Mode**: Upload 100 custom captcha images with answers
- **Google reCAPTCHA**: Alternative automated verification
- **Answer Hashing**: Secure server-side answer verification
- **Asset Rotation**: Prevent overexposure of captcha images

## 🔐 Security Features

### Authentication & Authorization
- **Email Verification**: Required for all new accounts
- **Admin Role Verification**: Multi-layer admin privilege checking
- **Session Management**: Secure session handling with automatic expiry

### Data Protection
- **Input Sanitization**: All user inputs sanitized against XSS/injection
- **File Upload Security**: Strict file type and size validation
- **Database Rules**: Comprehensive row-level security
- **Storage Rules**: Secure file access controls

### Rate Limiting
- **Order Creation**: 5 orders per 5 minutes per user
- **Captcha Attempts**: 10 attempts per 5 minutes per IP
- **Chat Messages**: 20 messages per minute per user
- **Login Attempts**: 5 attempts per 5 minutes per email

## 📊 Monitoring & Analytics

### Order Tracking
- **Status Lifecycle**: Complete order status tracking
- **Admin Actions**: Audit trail of all admin actions
- **Customer Notifications**: Automated status update notifications

### Performance Monitoring
- **Error Tracking**: Comprehensive error logging and reporting
- **Function Metrics**: Cloud Function performance monitoring
- **Database Usage**: Real-time database usage tracking

## 🛠️ Development

### Local Development
```bash
# Start development server
npm run dev

# Start Firebase emulators
firebase emulators:start

# Run functions locally
cd functions && npm run serve
```

### Testing
```bash
# Run unit tests
npm test

# Test Cloud Functions
cd functions && npm test

# Integration testing
npm run test:integration
```

### Code Quality
- **ESLint**: JavaScript linting and formatting
- **Security Scanning**: Automated vulnerability scanning
- **Performance Auditing**: Lighthouse CI integration

## 📈 Scaling Considerations

### Performance Optimization
- **Database Indexing**: Optimized queries with proper indexing
- **Caching Strategy**: Client-side caching for configuration data
- **Image Optimization**: Compressed images and lazy loading
- **CDN Integration**: Firebase Hosting CDN for global performance

### Capacity Planning
- **Concurrent Users**: Designed for 1000+ concurrent users
- **Order Volume**: Handles 10,000+ orders per day
- **Storage Scaling**: Automatic scaling for file uploads
- **Function Scaling**: Auto-scaling Cloud Functions

## 🔄 Backup & Recovery

### Data Backup
- **Automated Backups**: Daily database exports to Cloud Storage
- **Configuration Backup**: Versioned configuration snapshots
- **File Backup**: Payment proof and asset backups

### Disaster Recovery
- **Multi-region Deployment**: Geographic redundancy
- **Rollback Procedures**: Quick rollback for critical issues
- **Data Recovery**: Point-in-time recovery capabilities

## 📞 Support & Maintenance

### Customer Support
- **AI Chat Bot**: 24/7 automated support with knowledge base
- **Human Escalation**: Seamless handoff to human agents
- **Ticket System**: Comprehensive support ticket management
- **Multi-language**: Support in English and Indonesian

### System Maintenance
- **Health Monitoring**: Automated system health checks
- **Update Procedures**: Safe deployment and rollback procedures
- **Security Updates**: Regular security patches and updates

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Contact

For support or inquiries:
- **Email**: support@growtopia-shop.com
- **Telegram**: @GrowtopiaShopSupport
- **Documentation**: [docs.growtopia-shop.com](https://docs.growtopia-shop.com)

---

**Built with ❤️ for the Growtopia community**
