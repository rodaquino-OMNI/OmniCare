export interface ReferralPriority {
  level: 'routine' | 'urgent' | 'stat';
  timeframe: string; // e.g., "within 2 weeks", "within 48 hours", "immediately"
  color: string; // for UI display
}

export interface SpecialtyProvider {
  id: string;
  name: string;
  specialty: string;
  subspecialties?: string[];
  organization: string;
  location: {
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    fax?: string;
  };
  availability: {
    nextAvailable: Date;
    averageWaitTime: number; // in days
    acceptingNewPatients: boolean;
  };
  insuranceAccepted: string[];
  languages: string[];
  credentials: string[];
  rating?: number;
  telemedCapable: boolean;
}

export interface ReferralPattern {
  id: string;
  name: string;
  specialty: string;
  commonDiagnoses: string[];
  requiredDocuments: string[];
  typicalWorkup: string[];
  insuranceRequirements: {
    requiresAuthorization: boolean;
    documentationNeeded: string[];
    typicalTurnaround: number; // in days
  };
  template: {
    reasonForReferral: string;
    clinicalQuestions: string[];
    suggestedTests: string[];
  };
}

export interface ReferralMetrics {
  referralId: string;
  timeToSchedule?: number; // days from referral to appointment scheduled
  timeToSeen?: number; // days from referral to patient seen
  timeToReport?: number; // days from seen to report received
  authorizationTime?: number; // days to get authorization
  patientNoShow: boolean;
  outcomeReported: boolean;
  followUpCompleted: boolean;
}

export interface ReferralNetwork {
  providerId: string;
  frequentReferrals: {
    targetProviderId: string;
    targetProviderName: string;
    specialty: string;
    count: number;
    averageTurnaround: number;
    satisfactionScore?: number;
  }[];
  preferredProviders: {
    specialty: string;
    providers: string[]; // provider IDs
  }[];
}

export interface InsuranceRequirement {
  insurerId: string;
  insurerName: string;
  specialty: string;
  requiresAuthorization: boolean;
  requiresReferral: boolean;
  authorizationCriteria: string[];
  documentationRequired: string[];
  validityPeriod: number; // days
  visitLimit?: number;
  networks: string[]; // in-network provider networks
}

export interface ReferralTemplate {
  id: string;
  name: string;
  specialty: string;
  description: string;
  sections: {
    clinicalHistory: {
      required: boolean;
      prompts: string[];
    };
    currentMedications: {
      required: boolean;
      includeAllergies: boolean;
    };
    vitalSigns: {
      required: boolean;
      specific: string[]; // e.g., ["blood pressure", "weight"]
    };
    diagnosticResults: {
      required: boolean;
      types: string[]; // e.g., ["labs", "imaging", "EKG"]
      timeframe: string; // e.g., "within 30 days"
    };
    specificQuestions: string[];
    urgencyGuidelines: {
      routine: string;
      urgent: string;
      stat: string;
    };
  };
}

export interface ReferralOutcome {
  referralId: string;
  seen: boolean;
  seenDate?: Date;
  diagnosis: string[];
  treatmentProvided: string;
  medicationsStarted?: string[];
  proceduresPerformed?: string[];
  followUpPlan: {
    withSpecialist: boolean;
    withPCP: boolean;
    timeframe?: string;
    specificInstructions?: string;
  };
  recommendationsImplemented: boolean;
  patientOutcome: 'improved' | 'stable' | 'worsened' | 'unknown';
}

export interface ReferralTracking {
  referralId: string;
  currentStatus: string;
  currentSubStatus?: string;
  timeline: {
    event: string;
    date: Date;
    performedBy: string;
    notes?: string;
  }[];
  pendingActions: {
    action: string;
    dueDate?: Date;
    assignedTo?: string;
    priority: 'low' | 'medium' | 'high';
  }[];
  communications: {
    date: Date;
    from: string;
    to: string;
    method: 'phone' | 'fax' | 'portal' | 'email';
    content: string;
    successful: boolean;
  }[];
}

export interface ReferralCoordination {
  referralId: string;
  coordinator?: {
    id: string;
    name: string;
    role: string;
  };
  transportationNeeds: {
    required: boolean;
    type?: 'ambulance' | 'wheelchair-van' | 'standard';
    arranged: boolean;
    details?: string;
  };
  interpretationNeeds: {
    required: boolean;
    language?: string;
    arranged: boolean;
    type?: 'in-person' | 'phone' | 'video';
  };
  specialAccommodations: string[];
  barriersToCare: {
    barrier: string;
    addressed: boolean;
    plan?: string;
  }[];
}