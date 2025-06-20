export interface CarePlanCategory {
  code: 'chronic-disease' | 'post-acute' | 'preventive' | 'behavioral' | 'palliative' | 'surgical' | 'maternity';
  display: string;
  description: string;
  typicalDuration?: string;
  reviewFrequency: string;
}

export interface CareTeamRole {
  id: string;
  title: string;
  responsibilities: string[];
  requiredQualifications?: string[];
  communicationPreferences: {
    preferredMethod: 'phone' | 'email' | 'portal' | 'pager';
    availability: string;
    responseTime: string;
  };
}

export interface CarePlanPhase {
  id: string;
  name: string;
  description: string;
  startCriteria: string[];
  completionCriteria: string[];
  typicalDuration: string;
  activities: string[];
  milestones: {
    description: string;
    targetDate?: string;
    isCritical: boolean;
  }[];
}

export interface PatientEngagement {
  planId: string;
  patientId: string;
  activationLevel: 'low' | 'moderate' | 'high';
  preferredLearningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  healthLiteracy: 'basic' | 'intermediate' | 'proficient';
  culturalConsiderations: string[];
  languagePreference: string;
  supportSystem: {
    hasCaregiver: boolean;
    caregiverRole?: string;
    caregiverInvolvement: 'primary' | 'supportive' | 'minimal';
  };
  barriers: {
    type: 'financial' | 'transportation' | 'cognitive' | 'physical' | 'social' | 'technological';
    description: string;
    interventions: string[];
  }[];
}

export interface CarePlanOutcome {
  planId: string;
  measurementDate: Date;
  outcomeType: 'clinical' | 'functional' | 'quality-of-life' | 'satisfaction';
  measures: {
    name: string;
    baselineValue: number | string;
    currentValue: number | string;
    targetValue: number | string;
    unit?: string;
    improvementRate?: number;
  }[];
  patientReportedOutcomes: {
    domain: string;
    score: number;
    maxScore: number;
    interpretation: string;
  }[];
  providerAssessment: {
    overallProgress: 'excellent' | 'good' | 'fair' | 'poor';
    clinicalNotes: string;
    recommendedAdjustments: string[];
  };
}

export interface CarePlanIntervention {
  id: string;
  type: 'medication' | 'procedure' | 'behavioral' | 'educational' | 'device' | 'dietary' | 'activity';
  name: string;
  description: string;
  evidence: {
    level: 'high' | 'moderate' | 'low';
    source: string;
    recommendationStrength: 'strong' | 'conditional';
  };
  frequency?: string;
  duration?: string;
  monitoring: {
    parameter: string;
    frequency: string;
    targetRange?: string;
  }[];
  contraindications?: string[];
  alternativeInterventions?: string[];
}

export interface CarePlanCommunication {
  planId: string;
  timestamp: Date;
  participants: {
    role: string;
    name: string;
    id: string;
  }[];
  type: 'team-meeting' | 'patient-update' | 'family-conference' | 'consultation' | 'handoff';
  mode: 'in-person' | 'video' | 'phone' | 'secure-message';
  summary: string;
  decisions: string[];
  actionItems: {
    task: string;
    assignedTo: string;
    dueDate?: Date;
    completed: boolean;
  }[];
  attachments?: {
    type: string;
    name: string;
    url: string;
  }[];
}

export interface CarePlanTransition {
  fromSetting: 'hospital' | 'snf' | 'home-health' | 'outpatient' | 'emergency';
  toSetting: 'hospital' | 'snf' | 'home-health' | 'outpatient' | 'home';
  transitionDate: Date;
  coordinator: {
    name: string;
    role: string;
    contact: string;
  };
  handoffElements: {
    element: string;
    status: 'completed' | 'pending' | 'not-applicable';
    notes?: string;
  }[];
  medicationReconciliation: {
    completed: boolean;
    changes: string[];
    verifiedBy: string;
  };
  followUpAppointments: {
    specialty: string;
    scheduledDate?: Date;
    priority: 'urgent' | 'routine';
    reason: string;
  }[];
  patientEducation: {
    topic: string;
    provided: boolean;
    understanding: 'demonstrated' | 'verbalized' | 'needs-reinforcement';
  }[];
}

export interface CarePlanQualityMetric {
  metricId: string;
  name: string;
  description: string;
  type: 'process' | 'outcome' | 'structure';
  numerator: string;
  denominator: string;
  target: number;
  currentValue: number;
  trend: 'improving' | 'stable' | 'declining';
  benchmarkComparison?: {
    nationalAverage: number;
    topDecile: number;
    organization: number;
  };
  improvementActions?: string[];
}

export interface CarePlanResourceUtilization {
  planId: string;
  period: {
    start: Date;
    end: Date;
  };
  encounters: {
    type: string;
    count: number;
    averageDuration?: number;
  }[];
  procedures: {
    name: string;
    count: number;
    totalCost?: number;
  }[];
  medications: {
    name: string;
    daysSupply: number;
    cost?: number;
  }[];
  totalCost?: number;
  costSavings?: number;
  readmissions: {
    count: number;
    preventable: number;
    reasons: string[];
  };
}

export interface SharedDecisionMaking {
  planId: string;
  decisionPoint: string;
  options: {
    name: string;
    benefits: string[];
    risks: string[];
    evidence: string;
    patientPreferenceScore?: number;
  }[];
  patientValues: string[];
  providerRecommendation?: string;
  decisionMade: string;
  decisionDate: Date;
  decisionAids: {
    type: 'video' | 'pamphlet' | 'decision-tree' | 'app';
    name: string;
    used: boolean;
  }[];
  documentedBy: string;
}