import cors from 'cors';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 8002;

// Basic middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Basic auth login endpoint
app.post('/auth/login', (req, res) => {
  const { username, email, password } = req.body;
  const userIdentifier = username || email;
  
  if (!userIdentifier || !password) {
    res.status(400).json({
      success: false,
      message: 'Username/email and password required'
    });
    return;
  }

  // Mock authentication for testing
  const user = {
    id: 'user_123',
    username: userIdentifier,
    role: 'physician',
    email: email || `${userIdentifier}@omnicare.com`,
    firstName: 'Dr. John',
    lastName: 'Doe',
    avatar: null
  };

  const tokens = {
    accessToken: 'mock_access_token_' + Date.now(),
    refreshToken: 'mock_refresh_token_' + Date.now(),
    expiresIn: 3600,
    tokenType: 'Bearer'
  };

  const session = {
    sessionId: 'session_' + Date.now(),
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  };

  res.json({
    success: true,
    user,
    tokens,
    session,
    permissions: ['read:patient', 'write:patient', 'read:observation']
  });
});

// Get current user endpoint
app.get('/auth/me', (req, res) => {
  // Mock user response
  const user = {
    id: 'user_123',
    username: 'test@example.com',
    role: 'physician',
    email: 'test@example.com',
    firstName: 'Dr. John',
    lastName: 'Doe',
    avatar: null
  };

  res.json({
    success: true,
    user,
    permissions: ['read:patient', 'write:patient', 'read:observation']
  });
});

// Logout endpoint
app.post('/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Test FHIR metadata endpoint  
app.get('/fhir/R4/metadata', (req, res) => {
  res.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    publisher: 'OmniCare EMR',
    kind: 'instance',
    software: {
      name: 'OmniCare FHIR Server',
      version: '1.0.0'
    },
    implementation: {
      description: 'OmniCare EMR FHIR Server'
    },
    fhirVersion: '4.0.1',
    format: ['application/fhir+json'],
    rest: [{
      mode: 'server',
      resource: [
        { type: 'Patient' },
        { type: 'Observation' },
        { type: 'Encounter' }
      ]
    }]
  });
});

// Start server
app.listen(PORT, () => {
  // Server started successfully
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Simple OmniCare backend running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log(`- Ping: http://localhost:${PORT}/ping`);
    console.log(`- Auth: http://localhost:${PORT}/auth/login`);
    console.log(`- FHIR: http://localhost:${PORT}/fhir/R4/metadata`);
  }
});