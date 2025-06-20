export interface VideoProvider {
  id: string;
  name: string;
  type: 'zoom' | 'teams' | 'webrtc' | 'doxy.me' | 'custom';
  apiEndpoint?: string;
  requiresAuth: boolean;
  supportedFeatures: VideoFeature[];
}

export type VideoFeature = 
  | 'screen-sharing'
  | 'recording'
  | 'virtual-background'
  | 'waiting-room'
  | 'chat'
  | 'file-sharing'
  | 'breakout-rooms'
  | 'multi-party';

export interface TelemedicineCapabilities {
  maxParticipants: number;
  maxDuration: number; // in minutes
  recordingEnabled: boolean;
  screenShareEnabled: boolean;
  virtualBackgroundEnabled: boolean;
  endToEndEncryption: boolean;
}

export interface VideoQualityMetrics {
  bandwidth: number;
  latency: number;
  packetLoss: number;
  jitter: number;
  videoResolution: string;
  audioQuality: 'poor' | 'fair' | 'good' | 'excellent';
  videoQuality: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface TelemedicineAuditLog {
  sessionId: string;
  eventType: TelemedicineEvent;
  timestamp: Date;
  userId: string;
  userRole: 'patient' | 'provider' | 'caregiver' | 'interpreter';
  details?: Record<string, any>;
  ipAddress?: string;
  deviceInfo?: string;
}

export type TelemedicineEvent = 
  | 'session-created'
  | 'participant-joined'
  | 'participant-left'
  | 'recording-started'
  | 'recording-stopped'
  | 'screen-share-started'
  | 'screen-share-stopped'
  | 'chat-message-sent'
  | 'file-shared'
  | 'technical-issue-reported'
  | 'session-ended'
  | 'consent-obtained';

export interface TelemedicineConsent {
  patientId: string;
  providerId: string;
  consentType: 'video-recording' | 'audio-recording' | 'telemedicine-service';
  consentGiven: boolean;
  consentDate: Date;
  expirationDate?: Date;
  restrictions?: string[];
  signature?: string;
}

export interface RemoteMonitoringDevice {
  deviceId: string;
  deviceType: 'blood-pressure' | 'glucose-meter' | 'pulse-oximeter' | 'scale' | 'thermometer';
  manufacturer: string;
  model: string;
  lastSync: Date;
  batteryLevel?: number;
  isActive: boolean;
  patientId: string;
}

export interface TelemedicinePrescription {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  refills: number;
  prescribedDuring: 'telemedicine' | 'in-person';
  electronicPrescriptionId?: string;
  pharmacyId?: string;
  sentToPharmacy: boolean;
  sentAt?: Date;
}

export interface TelemedicineFollowUp {
  recommendationType: 'in-person-visit' | 'telemedicine-followup' | 'lab-work' | 'imaging' | 'specialist-referral';
  urgency: 'routine' | 'urgent' | 'emergent';
  timeframe: string; // e.g., "within 48 hours", "1-2 weeks"
  reason: string;
  specialInstructions?: string;
}

export interface TelemedicineSessionSecurity {
  sessionId: string;
  encryptionEnabled: boolean;
  encryptionType: 'AES-256' | 'E2EE';
  waitingRoomEnabled: boolean;
  accessCode?: string;
  maxAttempts: number;
  sessionTimeout: number; // minutes
  recordingConsent: boolean;
  participantVerification: 'none' | 'pin' | 'two-factor';
}