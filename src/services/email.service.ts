/**
 * OmniCare EMR - Email Service
 * Handles email sending, templates, and notification management using Nodemailer
 */

import nodemailer from 'nodemailer';
import { EventEmitter } from 'events';
import logger from '@/utils/logger';

export interface EmailConfiguration {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    tls?: {
      rejectUnauthorized: boolean;
    };
  };
  defaults: {
    from: string;
    replyTo?: string;
    bcc?: string[];
    priority?: 'high' | 'normal' | 'low';
  };
  limits: {
    maxRecipientsPerEmail: number;
    maxEmailsPerHour: number;
    maxAttachmentSize: number; // in bytes
  };
  templates: {
    baseUrl?: string;
    defaultLanguage: string;
    supportedLanguages: string[];
  };
}

export interface EmailMessage {
  id: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  priority?: 'high' | 'normal' | 'low';
  deliveryTime?: Date;
  replyTo?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
  contentDisposition?: 'attachment' | 'inline';
  cid?: string; // Content-ID for inline attachments
  encoding?: string;
  size?: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: TemplateVariable[];
  isActive: boolean;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object';
  required: boolean;
  defaultValue?: any;
  description?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
  };
}

export interface EmailDeliveryStatus {
  messageId: string;
  status: DeliveryStatus;
  timestamp: Date;
  recipient: string;
  error?: string;
  attempts: number;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  unsubscribedAt?: Date;
}

export enum DeliveryStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  FAILED = 'failed',
  UNSUBSCRIBED = 'unsubscribed',
  COMPLAINED = 'complained'
}

export interface EmailQueue {
  id: string;
  name: string;
  priority: number;
  maxConcurrency: number;
  retryConfig: {
    enabled: boolean;
    maxRetries: number;
    backoffStrategy: 'exponential' | 'linear' | 'fixed';
    initialDelay: number;
    maxDelay: number;
  };
  messages: QueuedMessage[];
  isProcessing: boolean;
  stats: QueueStats;
}

export interface QueuedMessage {
  id: string;
  message: EmailMessage;
  queuedAt: Date;
  scheduledFor?: Date;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  priority: number;
}

export interface QueueStats {
  totalMessages: number;
  pendingMessages: number;
  processingMessages: number;
  sentMessages: number;
  failedMessages: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
}

export interface EmailAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
  topTemplates: Array<{ templateId: string; count: number }>;
  topRecipients: Array<{ recipient: string; count: number }>;
  hourlyStats: Array<{ hour: number; sent: number; opened: number }>;
}

export interface EmailNotification {
  id: string;
  type: NotificationType;
  recipientType: 'patient' | 'provider' | 'admin' | 'system';
  recipients: string[];
  templateId?: string;
  subject: string;
  content: string;
  priority: 'high' | 'normal' | 'low';
  sendAt?: Date;
  sentAt?: Date;
  status: NotificationStatus;
  metadata?: Record<string, any>;
  unsubscribeToken?: string;
}

export enum NotificationType {
  APPOINTMENT_REMINDER = 'appointment_reminder',
  APPOINTMENT_CONFIRMATION = 'appointment_confirmation',
  APPOINTMENT_CANCELLATION = 'appointment_cancellation',
  LAB_RESULTS = 'lab_results',
  CRITICAL_ALERT = 'critical_alert',
  PRESCRIPTION_READY = 'prescription_ready',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SECURITY_ALERT = 'security_alert',
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password_reset',
  NEWSLETTER = 'newsletter',
  CUSTOM = 'custom'
}

export enum NotificationStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface UnsubscribeRequest {
  token: string;
  email: string;
  notificationType?: NotificationType;
  unsubscribeAll: boolean;
  requestedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export class EmailService extends EventEmitter {
  private transporter: nodemailer.Transporter;
  private config: EmailConfiguration;
  private templates: Map<string, EmailTemplate> = new Map();
  private deliveryStatus: Map<string, EmailDeliveryStatus> = new Map();
  private queues: Map<string, EmailQueue> = new Map();
  private notifications: Map<string, EmailNotification> = new Map();
  private unsubscribes: Map<string, UnsubscribeRequest> = new Map();
  private rateLimiter: { count: number; resetTime: number } = { count: 0, resetTime: 0 };

  constructor(config?: Partial<EmailConfiguration>) {
    super();
    
    this.config = {
      smtp: {
        host: config?.smtp?.host || process.env.SMTP_HOST || 'localhost',
        port: config?.smtp?.port || parseInt(process.env.SMTP_PORT || '587'),
        secure: config?.smtp?.secure || false,
        auth: {
          user: config?.smtp?.auth?.user || process.env.SMTP_USER || '',
          pass: config?.smtp?.auth?.pass || process.env.SMTP_PASS || ''
        },
        tls: {
          rejectUnauthorized: config?.smtp?.tls?.rejectUnauthorized !== false
        }
      },
      defaults: {
        from: config?.defaults?.from || process.env.SMTP_FROM || 'noreply@omnicare.com',
        replyTo: config?.defaults?.replyTo,
        bcc: config?.defaults?.bcc,
        priority: config?.defaults?.priority || 'normal'
      },
      limits: {
        maxRecipientsPerEmail: config?.limits?.maxRecipientsPerEmail || 50,
        maxEmailsPerHour: config?.limits?.maxEmailsPerHour || 1000,
        maxAttachmentSize: config?.limits?.maxAttachmentSize || 25 * 1024 * 1024 // 25MB
      },
      templates: {
        baseUrl: config?.templates?.baseUrl || process.env.EMAIL_TEMPLATE_BASE_URL,
        defaultLanguage: config?.templates?.defaultLanguage || 'en',
        supportedLanguages: config?.templates?.supportedLanguages || ['en', 'es', 'fr']
      }
    };

    this.initializeService();
  }

  /**
   * Initialize email service
   */
  private async initializeService(): Promise<void> {
    try {
      logger.info('Initializing email service');

      // Create nodemailer transporter
      this.transporter = nodemailer.createTransporter({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: this.config.smtp.auth,
        tls: this.config.smtp.tls
      });

      // Verify SMTP connection
      await this.verifyConnection();

      // Load email templates
      await this.loadTemplates();

      // Initialize default queue
      await this.createQueue('default', { priority: 1, maxConcurrency: 5 });

      // Start queue processing
      this.startQueueProcessing();

      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      throw new Error(`Email service initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send email message
   */
  async sendEmail(
    message: Omit<EmailMessage, 'id'>,
    queueName: string = 'default'
  ): Promise<{ messageId: string; queued: boolean }> {
    try {
      // Generate message ID
      const messageId = this.generateMessageId();
      const fullMessage: EmailMessage = {
        id: messageId,
        ...message
      };

      // Validate message
      await this.validateMessage(fullMessage);

      // Check rate limits
      if (!this.checkRateLimit()) {
        throw new Error('Rate limit exceeded');
      }

      // Add to queue
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      const queuedMessage: QueuedMessage = {
        id: this.generateQueuedMessageId(),
        message: fullMessage,
        queuedAt: new Date(),
        scheduledFor: message.deliveryTime,
        attempts: 0,
        priority: this.getPriorityNumber(message.priority || 'normal')
      };

      queue.messages.push(queuedMessage);
      queue.stats.totalMessages++;
      queue.stats.pendingMessages++;

      // Create delivery status record
      const recipients = Array.isArray(fullMessage.to) ? fullMessage.to : [fullMessage.to];
      recipients.forEach(recipient => {
        this.deliveryStatus.set(`${messageId}_${recipient}`, {
          messageId,
          status: DeliveryStatus.QUEUED,
          timestamp: new Date(),
          recipient,
          attempts: 0
        });
      });

      this.emit('emailQueued', { messageId, queueName });
      logger.debug(`Email queued: ${messageId} in queue ${queueName}`);

      return { messageId, queued: true };
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw new Error(`Email send error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(
    templateId: string,
    recipients: string | string[],
    variables: Record<string, any>,
    options?: {
      language?: string;
      priority?: 'high' | 'normal' | 'low';
      deliveryTime?: Date;
      queueName?: string;
    }
  ): Promise<{ messageId: string; queued: boolean }> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      if (!template.isActive) {
        throw new Error(`Template is not active: ${templateId}`);
      }

      // Validate variables
      await this.validateTemplateVariables(template, variables);

      // Render template
      const renderedSubject = this.renderTemplate(template.subject, variables);
      const renderedHtml = this.renderTemplate(template.htmlTemplate, variables);
      const renderedText = template.textTemplate 
        ? this.renderTemplate(template.textTemplate, variables)
        : undefined;

      // Send email
      return this.sendEmail({
        to: recipients,
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
        priority: options?.priority,
        deliveryTime: options?.deliveryTime,
        metadata: {
          templateId,
          templateVersion: template.version,
          variables
        }
      }, options?.queueName);
    } catch (error) {
      logger.error('Failed to send template email:', error);
      throw new Error(`Template email error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send notification
   */
  async sendNotification(notification: Omit<EmailNotification, 'id' | 'sentAt' | 'status'>): Promise<string> {
    try {
      const notificationId = this.generateNotificationId();
      const fullNotification: EmailNotification = {
        id: notificationId,
        status: NotificationStatus.DRAFT,
        ...notification
      };

      // Generate unsubscribe token for marketing emails
      if (this.isMarketingType(notification.type)) {
        fullNotification.unsubscribeToken = this.generateUnsubscribeToken(notificationId);
      }

      // Store notification
      this.notifications.set(notificationId, fullNotification);

      // Send email
      let result;
      if (notification.templateId) {
        result = await this.sendTemplateEmail(
          notification.templateId,
          notification.recipients,
          notification.metadata || {},
          {
            priority: notification.priority,
            deliveryTime: notification.sendAt
          }
        );
      } else {
        result = await this.sendEmail({
          to: notification.recipients,
          subject: notification.subject,
          html: notification.content,
          priority: notification.priority,
          deliveryTime: notification.sendAt,
          metadata: {
            notificationId,
            notificationType: notification.type,
            unsubscribeToken: fullNotification.unsubscribeToken
          }
        });
      }

      fullNotification.status = NotificationStatus.SENT;
      fullNotification.sentAt = new Date();

      this.emit('notificationSent', fullNotification);
      logger.info(`Notification sent: ${notificationId} (${notification.type})`);

      return notificationId;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw new Error(`Notification send error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process unsubscribe request
   */
  async processUnsubscribe(
    token: string,
    options?: {
      notificationType?: NotificationType;
      unsubscribeAll?: boolean;
      ipAddress?: string;
      userAgent?: string;
      reason?: string;
    }
  ): Promise<void> {
    try {
      // Verify token and get associated email
      const email = this.verifyUnsubscribeToken(token);
      if (!email) {
        throw new Error('Invalid unsubscribe token');
      }

      const unsubscribeRequest: UnsubscribeRequest = {
        token,
        email,
        notificationType: options?.notificationType,
        unsubscribeAll: options?.unsubscribeAll || false,
        requestedAt: new Date(),
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        reason: options?.reason
      };

      // Store unsubscribe request
      this.unsubscribes.set(token, unsubscribeRequest);

      // TODO: Update user preferences in database
      // TODO: Add email to suppression list

      this.emit('unsubscribeProcessed', unsubscribeRequest);
      logger.info(`Unsubscribe processed for ${email}: ${options?.notificationType || 'all'}`);
    } catch (error) {
      logger.error('Failed to process unsubscribe:', error);
      throw new Error(`Unsubscribe error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(messageId: string, recipient?: string): EmailDeliveryStatus | EmailDeliveryStatus[] {
    if (recipient) {
      const key = `${messageId}_${recipient}`;
      return this.deliveryStatus.get(key)!;
    }

    // Return all statuses for this message
    const statuses: EmailDeliveryStatus[] = [];
    for (const [key, status] of this.deliveryStatus.entries()) {
      if (key.startsWith(`${messageId}_`)) {
        statuses.push(status);
      }
    }
    return statuses;
  }

  /**
   * Get email analytics
   */
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<EmailAnalytics> {
    const statuses = Array.from(this.deliveryStatus.values());
    const filteredStatuses = dateRange
      ? statuses.filter(s => s.timestamp >= dateRange.start && s.timestamp <= dateRange.end)
      : statuses;

    const totalSent = filteredStatuses.filter(s => s.status !== DeliveryStatus.PENDING && s.status !== DeliveryStatus.QUEUED).length;
    const totalDelivered = filteredStatuses.filter(s => s.status === DeliveryStatus.DELIVERED).length;
    const totalOpened = filteredStatuses.filter(s => s.status === DeliveryStatus.OPENED).length;
    const totalClicked = filteredStatuses.filter(s => s.status === DeliveryStatus.CLICKED).length;
    const totalBounced = filteredStatuses.filter(s => s.status === DeliveryStatus.BOUNCED).length;
    const totalComplained = filteredStatuses.filter(s => s.status === DeliveryStatus.COMPLAINED).length;

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      totalComplained,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
      bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      complaintRate: totalSent > 0 ? (totalComplained / totalSent) * 100 : 0,
      topTemplates: [], // TODO: Calculate from notifications
      topRecipients: [], // TODO: Calculate from statuses
      hourlyStats: [] // TODO: Calculate hourly breakdown
    };
  }

  /**
   * Create email template
   */
  async createTemplate(templateData: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    const template: EmailTemplate = {
      id: this.generateTemplateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...templateData
    };

    // Validate template
    await this.validateTemplate(template);

    // Store template
    this.templates.set(template.id, template);

    this.emit('templateCreated', template);
    logger.info(`Email template created: ${template.id} - ${template.name}`);

    return template;
  }

  /**
   * Verify SMTP connection
   */
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified');
    } catch (error) {
      logger.error('SMTP connection verification failed:', error);
      throw new Error('Failed to verify SMTP connection');
    }
  }

  /**
   * Load email templates
   */
  private async loadTemplates(): Promise<void> {
    // TODO: Load templates from database or file system
    
    // Create default templates
    await this.createDefaultTemplates();
    
    logger.info(`Loaded ${this.templates.size} email templates`);
  }

  /**
   * Create default templates
   */
  private async createDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      {
        name: 'Appointment Reminder',
        description: 'Reminds patients of upcoming appointments',
        category: 'appointment',
        language: 'en',
        subject: 'Appointment Reminder - {{appointmentDate}}',
        htmlTemplate: `
          <h2>Appointment Reminder</h2>
          <p>Dear {{patientName}},</p>
          <p>This is a reminder of your upcoming appointment:</p>
          <ul>
            <li><strong>Date:</strong> {{appointmentDate}}</li>
            <li><strong>Time:</strong> {{appointmentTime}}</li>
            <li><strong>Provider:</strong> {{providerName}}</li>
            <li><strong>Location:</strong> {{location}}</li>
          </ul>
          <p>Please arrive 15 minutes early for check-in.</p>
          <p>Thank you,<br>OmniCare Team</p>
        `,
        textTemplate: `
          Appointment Reminder
          
          Dear {{patientName}},
          
          This is a reminder of your upcoming appointment:
          
          Date: {{appointmentDate}}
          Time: {{appointmentTime}}
          Provider: {{providerName}}
          Location: {{location}}
          
          Please arrive 15 minutes early for check-in.
          
          Thank you,
          OmniCare Team
        `,
        variables: [
          { name: 'patientName', type: 'string', required: true },
          { name: 'appointmentDate', type: 'date', required: true },
          { name: 'appointmentTime', type: 'string', required: true },
          { name: 'providerName', type: 'string', required: true },
          { name: 'location', type: 'string', required: true }
        ],
        isActive: true,
        version: '1.0',
        createdBy: 'system'
      },
      {
        name: 'Lab Results Available',
        description: 'Notifies patients when lab results are available',
        category: 'lab',
        language: 'en',
        subject: 'Lab Results Available',
        htmlTemplate: `
          <h2>Lab Results Available</h2>
          <p>Dear {{patientName}},</p>
          <p>Your lab results from {{testDate}} are now available.</p>
          <p>Please log into your patient portal or contact your provider to review your results.</p>
          <p>If you have any questions, please don't hesitate to contact our office.</p>
          <p>Thank you,<br>OmniCare Team</p>
        `,
        variables: [
          { name: 'patientName', type: 'string', required: true },
          { name: 'testDate', type: 'date', required: true }
        ],
        isActive: true,
        version: '1.0',
        createdBy: 'system'
      }
    ];

    for (const templateData of defaultTemplates) {
      await this.createTemplate(templateData as any);
    }
  }

  /**
   * Create queue for email processing
   */
  private async createQueue(
    name: string,
    config: {
      priority?: number;
      maxConcurrency?: number;
      retryConfig?: Partial<EmailQueue['retryConfig']>;
    }
  ): Promise<EmailQueue> {
    const queue: EmailQueue = {
      id: this.generateQueueId(),
      name,
      priority: config.priority || 1,
      maxConcurrency: config.maxConcurrency || 5,
      retryConfig: {
        enabled: true,
        maxRetries: 3,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000,
        ...config.retryConfig
      },
      messages: [],
      isProcessing: false,
      stats: {
        totalMessages: 0,
        pendingMessages: 0,
        processingMessages: 0,
        sentMessages: 0,
        failedMessages: 0,
        averageProcessingTime: 0
      }
    };

    this.queues.set(name, queue);
    return queue;
  }

  /**
   * Start queue processing
   */
  private startQueueProcessing(): void {
    setInterval(() => {
      for (const queue of this.queues.values()) {
        this.processQueue(queue);
      }
    }, 1000); // Process every second

    logger.info('Email queue processing started');
  }

  /**
   * Process queue messages
   */
  private async processQueue(queue: EmailQueue): Promise<void> {
    if (queue.isProcessing || queue.messages.length === 0) {
      return;
    }

    queue.isProcessing = true;

    try {
      // Sort by priority and scheduled time
      queue.messages.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        const aTime = a.scheduledFor || a.queuedAt;
        const bTime = b.scheduledFor || b.queuedAt;
        return aTime.getTime() - bTime.getTime();
      });

      const processing: Promise<void>[] = [];
      const now = new Date();

      for (let i = 0; i < Math.min(queue.maxConcurrency, queue.messages.length); i++) {
        const queuedMessage = queue.messages[i];
        
        // Skip if scheduled for future
        if (queuedMessage.scheduledFor && queuedMessage.scheduledFor > now) {
          continue;
        }

        // Remove from queue and process
        queue.messages.splice(i, 1);
        i--;

        processing.push(this.processQueuedMessage(queuedMessage, queue));
      }

      await Promise.allSettled(processing);
    } finally {
      queue.isProcessing = false;
    }
  }

  /**
   * Process individual queued message
   */
  private async processQueuedMessage(queuedMessage: QueuedMessage, queue: EmailQueue): Promise<void> {
    const startTime = Date.now();

    try {
      queue.stats.processingMessages++;
      queuedMessage.attempts++;
      queuedMessage.lastAttempt = new Date();

      // Update delivery status
      const recipients = Array.isArray(queuedMessage.message.to) 
        ? queuedMessage.message.to 
        : [queuedMessage.message.to];

      recipients.forEach(recipient => {
        const statusKey = `${queuedMessage.message.id}_${recipient}`;
        const status = this.deliveryStatus.get(statusKey);
        if (status) {
          status.status = DeliveryStatus.SENDING;
          status.attempts++;
        }
      });

      // Send email via nodemailer
      const mailOptions = {
        from: this.config.defaults.from,
        to: queuedMessage.message.to,
        cc: queuedMessage.message.cc,
        bcc: queuedMessage.message.bcc,
        subject: queuedMessage.message.subject,
        html: queuedMessage.message.html,
        text: queuedMessage.message.text,
        attachments: queuedMessage.message.attachments,
        priority: queuedMessage.message.priority,
        replyTo: queuedMessage.message.replyTo || this.config.defaults.replyTo,
        messageId: queuedMessage.message.messageId,
        inReplyTo: queuedMessage.message.inReplyTo,
        references: queuedMessage.message.references,
        headers: queuedMessage.message.headers
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Update delivery status to sent
      recipients.forEach(recipient => {
        const statusKey = `${queuedMessage.message.id}_${recipient}`;
        const status = this.deliveryStatus.get(statusKey);
        if (status) {
          status.status = DeliveryStatus.SENT;
          status.deliveredAt = new Date();
        }
      });

      // Update queue stats
      queue.stats.processingMessages--;
      queue.stats.pendingMessages--;
      queue.stats.sentMessages++;
      
      const processingTime = Date.now() - startTime;
      queue.stats.averageProcessingTime = 
        (queue.stats.averageProcessingTime * (queue.stats.sentMessages - 1) + processingTime) / queue.stats.sentMessages;
      queue.stats.lastProcessedAt = new Date();

      this.emit('emailSent', { messageId: queuedMessage.message.id, result });
      logger.debug(`Email sent: ${queuedMessage.message.id}`);

    } catch (error) {
      queuedMessage.error = error instanceof Error ? error.message : 'Unknown error';

      // Update delivery status to failed
      const recipients = Array.isArray(queuedMessage.message.to) 
        ? queuedMessage.message.to 
        : [queuedMessage.message.to];

      recipients.forEach(recipient => {
        const statusKey = `${queuedMessage.message.id}_${recipient}`;
        const status = this.deliveryStatus.get(statusKey);
        if (status) {
          status.status = DeliveryStatus.FAILED;
          status.error = queuedMessage.error;
        }
      });

      // Retry if configured
      if (queue.retryConfig.enabled && queuedMessage.attempts < queue.retryConfig.maxRetries) {
        const delay = this.calculateRetryDelay(queuedMessage.attempts, queue.retryConfig);
        
        setTimeout(() => {
          queue.messages.push(queuedMessage);
        }, delay);

        logger.warn(`Email send failed, retrying in ${delay}ms: ${queuedMessage.message.id}`);
      } else {
        queue.stats.processingMessages--;
        queue.stats.pendingMessages--;
        queue.stats.failedMessages++;

        this.emit('emailFailed', { messageId: queuedMessage.message.id, error: queuedMessage.error });
        logger.error(`Email send failed permanently: ${queuedMessage.message.id}:`, error);
      }
    }
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(attempt: number, retryConfig: EmailQueue['retryConfig']): number {
    switch (retryConfig.backoffStrategy) {
      case 'exponential':
        return Math.min(retryConfig.initialDelay * Math.pow(2, attempt - 1), retryConfig.maxDelay);
      case 'linear':
        return Math.min(retryConfig.initialDelay * attempt, retryConfig.maxDelay);
      case 'fixed':
      default:
        return retryConfig.initialDelay;
    }
  }

  /**
   * Validate email message
   */
  private async validateMessage(message: EmailMessage): Promise<void> {
    const errors: string[] = [];

    // Basic validation
    if (!message.to) errors.push('Recipient is required');
    if (!message.subject) errors.push('Subject is required');
    if (!message.html && !message.text) errors.push('Message content is required');

    // Recipient count validation
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    if (recipients.length > this.config.limits.maxRecipientsPerEmail) {
      errors.push(`Too many recipients (max: ${this.config.limits.maxRecipientsPerEmail})`);
    }

    // Attachment size validation
    if (message.attachments) {
      const totalSize = message.attachments.reduce((sum, att) => sum + (att.size || 0), 0);
      if (totalSize > this.config.limits.maxAttachmentSize) {
        errors.push(`Attachments too large (max: ${this.config.limits.maxAttachmentSize} bytes)`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Message validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate template variables
   */
  private async validateTemplateVariables(template: EmailTemplate, variables: Record<string, any>): Promise<void> {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = variables[variable.name];

      if (variable.required && (value === undefined || value === null)) {
        errors.push(`Required variable missing: ${variable.name}`);
        continue;
      }

      if (value !== undefined && variable.validation) {
        const validation = variable.validation;
        
        if (validation.pattern && !new RegExp(validation.pattern).test(String(value))) {
          errors.push(`Variable ${variable.name} does not match pattern: ${validation.pattern}`);
        }
        
        if (validation.minLength && String(value).length < validation.minLength) {
          errors.push(`Variable ${variable.name} too short (min: ${validation.minLength})`);
        }
        
        if (validation.maxLength && String(value).length > validation.maxLength) {
          errors.push(`Variable ${variable.name} too long (max: ${validation.maxLength})`);
        }
        
        if (validation.minValue && Number(value) < validation.minValue) {
          errors.push(`Variable ${variable.name} too small (min: ${validation.minValue})`);
        }
        
        if (validation.maxValue && Number(value) > validation.maxValue) {
          errors.push(`Variable ${variable.name} too large (max: ${validation.maxValue})`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Template variable validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate template
   */
  private async validateTemplate(template: EmailTemplate): Promise<void> {
    const errors: string[] = [];

    if (!template.name) errors.push('Template name is required');
    if (!template.subject) errors.push('Template subject is required');
    if (!template.htmlTemplate) errors.push('Template HTML content is required');
    if (!template.language) errors.push('Template language is required');

    if (!this.config.templates.supportedLanguages.includes(template.language)) {
      errors.push(`Unsupported language: ${template.language}`);
    }

    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Render template with variables
   */
  private renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const value = variables[variableName.trim()];
      if (value === undefined || value === null) {
        return match; // Keep placeholder if variable not found
      }
      
      // Format dates
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      
      return String(value);
    });
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;

    // Reset counter if hour has passed
    if (now - this.rateLimiter.resetTime > hourInMs) {
      this.rateLimiter.count = 0;
      this.rateLimiter.resetTime = now;
    }

    // Check if under limit
    if (this.rateLimiter.count >= this.config.limits.maxEmailsPerHour) {
      return false;
    }

    this.rateLimiter.count++;
    return true;
  }

  /**
   * Get priority number
   */
  private getPriorityNumber(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Check if notification type is marketing
   */
  private isMarketingType(type: NotificationType): boolean {
    const marketingTypes = [NotificationType.NEWSLETTER, NotificationType.CUSTOM];
    return marketingTypes.includes(type);
  }

  /**
   * Generate unsubscribe token
   */
  private generateUnsubscribeToken(notificationId: string): string {
    // In production, this should be a secure token with expiration
    return Buffer.from(notificationId).toString('base64');
  }

  /**
   * Verify unsubscribe token
   */
  private verifyUnsubscribeToken(token: string): string | null {
    try {
      const notificationId = Buffer.from(token, 'base64').toString();
      const notification = this.notifications.get(notificationId);
      return notification ? notification.recipients[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate unique IDs
   */
  private generateMessageId(): string {
    return `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateQueuedMessageId(): string {
    return `qmsg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateTemplateId(): string {
    return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notif_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateQueueId(): string {
    return `queue_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: string; details: any } {
    const queueStats = Array.from(this.queues.values()).map(queue => ({
      name: queue.name,
      pendingMessages: queue.stats.pendingMessages,
      processingMessages: queue.stats.processingMessages,
      sentMessages: queue.stats.sentMessages,
      failedMessages: queue.stats.failedMessages
    }));

    const totalPending = queueStats.reduce((sum, q) => sum + q.pendingMessages, 0);
    const isHealthy = totalPending < 100; // Threshold for healthy status

    return {
      status: isHealthy ? 'UP' : 'DEGRADED',
      details: {
        queues: queueStats,
        templatesCount: this.templates.size,
        notificationsCount: this.notifications.size,
        rateLimitRemaining: this.config.limits.maxEmailsPerHour - this.rateLimiter.count
      }
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.removeAllListeners();
    this.transporter.close();
    this.templates.clear();
    this.deliveryStatus.clear();
    this.queues.clear();
    this.notifications.clear();
    this.unsubscribes.clear();
    logger.info('Email service shut down');
  }
}

// Export singleton instance
export const emailService = new EmailService();