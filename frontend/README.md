# OmniCare EMR Frontend

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white)
![Mantine](https://img.shields.io/badge/Mantine-339AF0?logo=mantine&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)

A modern, responsive frontend for the OmniCare EMR system built with Next.js 15, React 19, and FHIR R4 integration through Medplum.

## 🚀 Features

### Core Clinical Features
- **FHIR R4 Compliant**: Full integration with FHIR resources through Medplum
- **Patient Management**: Comprehensive patient registration, demographics, and care coordination
- **Clinical Documentation**: Advanced clinical note-taking with offline support
- **Appointment Scheduling**: Interactive calendar with provider availability
- **Lab Results & Imaging**: Integration with diagnostic systems
- **Medication Management**: Prescription and medication reconciliation workflows
- **Care Team Coordination**: Task-based workflows for clinical teams

### Advanced Capabilities
- **Offline-First Architecture**: IndexedDB-based offline data storage and synchronization
- **Real-time Updates**: WebSocket integration for live data updates
- **Progressive Web App**: Service worker for offline functionality
- **Mobile Responsive**: Optimized for tablets and mobile devices
- **Accessibility**: WCAG 2.1 AA compliant with screen reader support
- **Performance Optimized**: React 19 concurrent features and optimized bundling

## 🏗️ Architecture

### Technology Stack
- **Framework**: Next.js 15 with App Router and Turbopack
- **UI Framework**: React 19 with concurrent features
- **Component Library**: Mantine 7.x with custom healthcare theme
- **Styling**: TailwindCSS with utility-first approach
- **State Management**: Zustand for lightweight state management
- **Data Fetching**: TanStack Query (React Query) with optimistic updates
- **FHIR Integration**: Medplum React SDK for healthcare data
- **Offline Storage**: IndexedDB with Dexie.js for structured data
- **Authentication**: JWT-based with multi-factor authentication support

### Key Directories
```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Main dashboard and clinical workflows
│   ├── patients/          # Patient management pages
│   ├── clinical/          # Clinical documentation and notes
│   └── api/               # API route handlers
├── components/            # Reusable UI components
│   ├── patient/           # Patient-specific components
│   ├── clinical/          # Clinical workflow components
│   ├── offline/           # Offline-first components
│   └── ui/                # Base UI components
├── services/              # Business logic and API integration
│   ├── fhir.service.ts    # FHIR resource management
│   ├── offline-sync.service.ts # Offline synchronization
│   └── indexeddb.service.ts # Local storage management
├── stores/                # Zustand state stores
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm 9+ or yarn 3+
- Modern web browser with IndexedDB support

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd OmniCare/frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Environment Configuration

Create a `.env.local` file with the following variables:

```bash
# Medplum Configuration
NEXT_PUBLIC_MEDPLUM_BASE_URL=https://api.medplum.com/fhir/R4
NEXT_PUBLIC_MEDPLUM_CLIENT_ID=your-client-id

# Backend API
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api

# Authentication
NEXT_PUBLIC_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_AUTH_CLIENT_ID=your-auth-client-id

# Feature Flags
NEXT_PUBLIC_ENABLE_OFFLINE_MODE=true
NEXT_PUBLIC_ENABLE_VOICE_RECOGNITION=false
```

## 📜 Available Scripts

```bash
# Development
npm run dev              # Start development server with Turbopack
npm run dev:debug        # Start with debug mode enabled

# Building
npm run build            # Build for production
npm run build:analyze    # Build with bundle analyzer
npm run start            # Start production server

# Testing
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:e2e         # Run end-to-end tests with Playwright
npm run test:coverage    # Generate coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run typecheck        # Run TypeScript type checking
```

## 🧪 Testing Strategy

### Unit Testing
- **Framework**: Jest with React Testing Library
- **Coverage**: Component logic, utility functions, and services
- **Mock Data**: FHIR-compliant test fixtures

### Integration Testing
- **Service Integration**: API endpoints and offline synchronization
- **Component Integration**: Complex workflows and data flow
- **IndexedDB Testing**: Offline storage and synchronization

### End-to-End Testing
- **Framework**: Playwright for cross-browser testing
- **Scenarios**: Complete clinical workflows
- **Accessibility**: Automated a11y testing

## 🔧 Configuration

### Mantine Theme
Custom healthcare theme with:
- Clinical color palette
- Accessible contrast ratios
- Medical iconography
- Responsive breakpoints

### Service Worker
Progressive Web App features:
- Offline caching strategy
- Background synchronization
- Push notifications
- Install prompts

### Performance Optimization
- Code splitting with Next.js dynamic imports
- Image optimization with Next.js Image
- Bundle analysis and optimization
- React 19 concurrent features

## 🛡️ Security & Compliance

### HIPAA Compliance
- **Data Encryption**: All PHI encrypted in transit and at rest
- **Access Control**: Role-based permissions and audit logging
- **Session Management**: Secure JWT tokens with refresh mechanism
- **Audit Trail**: Comprehensive logging of all user actions

### Security Features
- Content Security Policy (CSP)
- XSS protection
- CSRF protection
- Secure cookie configuration
- Rate limiting

## 📱 Offline Capabilities

### Data Storage
- **IndexedDB**: Primary offline storage for FHIR resources
- **Encrypted Storage**: Sensitive data encrypted locally
- **Selective Sync**: Only sync relevant patient data

### Synchronization
- **Conflict Resolution**: Intelligent merge strategies
- **Delta Sync**: Only sync changed data
- **Background Sync**: Automatic sync when connection restored

## 🎯 Performance Metrics

### Core Web Vitals
- **LCP**: < 2.5s (First Contentful Paint)
- **FID**: < 100ms (First Input Delay)
- **CLS**: < 0.1 (Cumulative Layout Shift)

### Bundle Size
- **Initial Bundle**: < 200KB gzipped
- **Route-based Splitting**: Lazy loading for clinical modules
- **Tree Shaking**: Optimized dependencies

## 🔄 Data Flow

### FHIR Integration
1. **Medplum Client**: Primary FHIR R4 client
2. **Resource Caching**: Intelligent caching with React Query
3. **Optimistic Updates**: Immediate UI updates with rollback
4. **Offline Queue**: Queue operations when offline

### State Management
- **Zustand Stores**: Lightweight state management
- **Persistent State**: Important state persisted to IndexedDB
- **Real-time Updates**: WebSocket integration for live data

## 🚀 Deployment

### Production Build
```bash
npm run build:production
npm run start
```

### Docker Deployment
```bash
docker build -t omnicare-frontend .
docker run -p 3000:3000 omnicare-frontend
```

### Vercel Deployment
```bash
vercel --prod
```

## 🐛 Troubleshooting

### Common Issues

#### Medplum Connection Issues
```bash
# Check Medplum configuration
npm run test:integration

# Verify environment variables
echo $NEXT_PUBLIC_MEDPLUM_BASE_URL
```

#### Offline Sync Problems
```bash
# Clear IndexedDB
# In browser console:
localStorage.clear();
indexedDB.deleteDatabase('OmniCareDB');
```

#### Build Issues
```bash
# Clear Next.js cache
npm run clean
npm run build
```

## 📊 Monitoring

### Performance Monitoring
- **Core Web Vitals**: Automated monitoring
- **Bundle Analysis**: Regular bundle size monitoring
- **Error Tracking**: Comprehensive error logging

### User Analytics
- **Usage Patterns**: Anonymous usage analytics
- **Performance Metrics**: Real user monitoring
- **Accessibility Metrics**: A11y compliance tracking

## 🤝 Contributing

### Development Workflow
1. Create feature branch from `main`
2. Follow TypeScript and React best practices
3. Add comprehensive tests
4. Ensure accessibility compliance
5. Submit pull request with detailed description

### Code Standards
- **TypeScript**: Strict mode enabled
- **ESLint**: Healthcare-specific linting rules
- **Prettier**: Consistent code formatting
- **Jest**: Comprehensive test coverage

## 📚 Documentation

- [API Documentation](../Docs/api-docs/)
- [Component Library](./src/components/README.md)
- [FHIR Integration Guide](../Docs/FHIR-INTEGRATION-GUIDE.md)
- [Offline Architecture](../Docs/OFFLINE_ARCHITECTURE_SPECIFICATION.md)
- [Security Guidelines](../Docs/SECURITY_GUIDELINES.md)

## 📄 License

Proprietary - OmniCare Healthcare Systems

---

**Built with ❤️ for Healthcare Providers**

*Improving patient care through better technology*
