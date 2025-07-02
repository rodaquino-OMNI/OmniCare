/**
 * Voice Recognition Service for Clinical Documentation
 * Supports medical vocabulary and offline capabilities
 */

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Speech Recognition Result Types
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

// Speech Grammar Types
interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechGrammarList {
  length: number;
  [index: number]: SpeechGrammar;
  addFromURI(src: string, weight?: number): void;
  addFromString(string: string, weight?: number): void;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  grammars: SpeechGrammarList;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare let webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

// Extend Window interface to include Speech Recognition APIs
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechGrammarList: {
      prototype: SpeechGrammarList;
      new(): SpeechGrammarList;
    };
    webkitSpeechGrammarList: {
      prototype: SpeechGrammarList;
      new(): SpeechGrammarList;
    };
  }
}

export interface VoiceRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  maxAlternatives?: number;
  medicalMode?: boolean;
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
}

export type VoiceRecognitionStatus = 
  | 'idle' 
  | 'listening' 
  | 'processing' 
  | 'error' 
  | 'not-supported';

export interface VoiceRecognitionCallbacks {
  onResult?: (result: VoiceRecognitionResult) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onStatusChange?: (status: VoiceRecognitionStatus) => void;
}

// Medical vocabulary for better recognition
const MEDICAL_VOCABULARY = [
  // Common medical terms
  'patient', 'diagnosis', 'treatment', 'medication', 'prescription',
  'symptoms', 'vital signs', 'blood pressure', 'heart rate', 'temperature',
  'respiratory rate', 'oxygen saturation', 'allergies', 'history',
  
  // Body systems
  'cardiovascular', 'respiratory', 'neurological', 'gastrointestinal',
  'musculoskeletal', 'endocrine', 'hematologic', 'dermatologic',
  
  // Common conditions
  'hypertension', 'diabetes', 'asthma', 'pneumonia', 'fracture',
  'infection', 'inflammation', 'pain', 'fever', 'nausea',
  
  // Medical abbreviations (spelled out)
  'milligrams', 'milliliters', 'beats per minute', 'millimeters of mercury',
  'degrees celsius', 'degrees fahrenheit', 'percent', 'units',
  
  // Documentation terms
  'assessment', 'plan', 'follow up', 'discharge', 'admission',
  'consultation', 'laboratory', 'radiology', 'imaging', 'test results'
];

// Medical phrase patterns for better context recognition
const MEDICAL_PHRASES = [
  'chief complaint',
  'history of present illness',
  'review of systems',
  'physical examination',
  'assessment and plan',
  'differential diagnosis',
  'vital signs stable',
  'no acute distress',
  'follow up in',
  'return if symptoms worsen',
  'patient education provided',
  'informed consent obtained'
];

class VoiceRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isSupported: boolean;
  private status: VoiceRecognitionStatus = 'idle';
  private callbacks: VoiceRecognitionCallbacks = {};
  private options: VoiceRecognitionOptions = {};
  private isListening = false;

  constructor() {
    this.isSupported = this.checkSupport();
    this.setupRecognition();
  }

  /**
   * Check if speech recognition is supported
   */
  private checkSupport(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Setup speech recognition with medical optimizations
   */
  private setupRecognition(): void {
    if (!this.isSupported) {
      this.setStatus('not-supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    if (this.recognition) {
      this.setupEventHandlers();
    }
  }

  /**
   * Setup event handlers for speech recognition
   */
  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.setStatus('listening');
      this.callbacks.onStart?.();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.setStatus('processing');
      this.handleResults(event);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.setStatus('idle');
      this.callbacks.onEnd?.();
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.isListening = false;
      this.setStatus('error');
      const errorMessage = this.getErrorMessage(event.error);
      this.callbacks.onError?.(errorMessage);
    };

    this.recognition.onnomatch = () => {
      this.callbacks.onError?.('No speech was recognized');
    };
  }

  /**
   * Handle recognition results
   */
  private handleResults(event: SpeechRecognitionEvent): void {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;

      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const transcript = finalTranscript || interimTranscript;
    const isFinal = !!finalTranscript;
    
    if (transcript) {
      const processedTranscript = this.processMedicalTranscript(transcript);
      
      const recognitionResult: VoiceRecognitionResult = {
        transcript: processedTranscript,
        confidence: event.results[event.resultIndex]?.[0]?.confidence || 0,
        isFinal,
        alternatives: this.getAlternatives(event.results[event.resultIndex])
      };

      this.callbacks.onResult?.(recognitionResult);
    }
  }

  /**
   * Process transcript for medical terminology
   */
  private processMedicalTranscript(transcript: string): string {
    let processed = transcript;

    // Auto-correct common medical terms
    const corrections = {
      'b p': 'blood pressure',
      'h r': 'heart rate',
      'temp': 'temperature',
      'resp': 'respiratory',
      'o two sat': 'oxygen saturation',
      'o2 sat': 'oxygen saturation',
      'mg': 'milligrams',
      'ml': 'milliliters',
      'bpm': 'beats per minute',
      'mmhg': 'millimeters of mercury',
      'pt': 'patient',
      'hx': 'history',
      'dx': 'diagnosis',
      'tx': 'treatment',
      'rx': 'prescription',
      'f u': 'follow up',
      'follow-up': 'follow up',
      'w n l': 'within normal limits',
      'n a d': 'no acute distress'
    };

    Object.entries(corrections).forEach(([abbreviation, fullForm]) => {
      const regex = new RegExp(`\\b${abbreviation}\\b`, 'gi');
      processed = processed.replace(regex, fullForm);
    });

    // Capitalize proper medical terms
    MEDICAL_VOCABULARY.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      processed = processed.replace(regex, term);
    });

    // Format medical phrases
    MEDICAL_PHRASES.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/\s/g, '\\s+'), 'gi');
      processed = processed.replace(regex, phrase);
    });

    return processed;
  }

  /**
   * Get alternative transcriptions
   */
  private getAlternatives(result: SpeechRecognitionResult): Array<{transcript: string; confidence: number}> {
    const alternatives = [];
    
    for (let i = 1; i < Math.min(result.length, 3); i++) {
      alternatives.push({
        transcript: this.processMedicalTranscript(result[i].transcript),
        confidence: result[i].confidence
      });
    }

    return alternatives;
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(error: string): string {
    const errorMessages = {
      'no-speech': 'No speech detected. Please try speaking again.',
      'aborted': 'Speech recognition was cancelled.',
      'audio-capture': 'Audio capture failed. Please check microphone permissions.',
      'network': 'Network error occurred. Speech recognition may not work offline.',
      'not-allowed': 'Microphone access denied. Please allow microphone access.',
      'service-not-allowed': 'Speech recognition service is not allowed.',
      'bad-grammar': 'Grammar error in speech recognition.',
      'language-not-supported': 'Language not supported.'
    };

    return errorMessages[error as keyof typeof errorMessages] || `Speech recognition error: ${error}`;
  }

  /**
   * Set status and notify callbacks
   */
  private setStatus(status: VoiceRecognitionStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  /**
   * Start voice recognition
   */
  public start(options: VoiceRecognitionOptions = {}, callbacks: VoiceRecognitionCallbacks = {}): boolean {
    if (!this.isSupported || !this.recognition) {
      callbacks.onError?.('Speech recognition is not supported on this device');
      return false;
    }

    if (this.isListening) {
      callbacks.onError?.('Voice recognition is already active');
      return false;
    }

    this.options = { ...options };
    this.callbacks = { ...callbacks };

    // Configure recognition
    this.recognition.continuous = options.continuous ?? true;
    this.recognition.interimResults = options.interimResults ?? true;
    this.recognition.lang = options.language ?? 'en-US';
    this.recognition.maxAlternatives = options.maxAlternatives ?? 3;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      this.callbacks.onError?.('Failed to start voice recognition');
      return false;
    }
  }

  /**
   * Stop voice recognition
   */
  public stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Abort voice recognition
   */
  public abort(): void {
    if (this.recognition && this.isListening) {
      this.recognition.abort();
    }
  }

  /**
   * Get current status
   */
  public getStatus(): VoiceRecognitionStatus {
    return this.status;
  }

  /**
   * Check if voice recognition is supported
   */
  public isAvailable(): boolean {
    return this.isSupported;
  }

  /**
   * Check if currently listening
   */
  public isActive(): boolean {
    return this.isListening;
  }

  /**
   * Get medical vocabulary for display
   */
  public getMedicalVocabulary(): string[] {
    return [...MEDICAL_VOCABULARY];
  }

  /**
   * Get medical phrases for display
   */
  public getMedicalPhrases(): string[] {
    return [...MEDICAL_PHRASES];
  }
}

// Singleton instance
const voiceRecognitionService = new VoiceRecognitionService();

export { voiceRecognitionService };
export default VoiceRecognitionService;