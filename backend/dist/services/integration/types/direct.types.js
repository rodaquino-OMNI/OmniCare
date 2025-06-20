"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectAuditEventType = exports.DirectAcknowledgmentType = exports.DirectMessageStatus = exports.DirectMessageSensitivity = exports.DirectMessagePriority = exports.DirectMessageType = void 0;
var DirectMessageType;
(function (DirectMessageType) {
    DirectMessageType["CLINICAL_SUMMARY"] = "clinical-summary";
    DirectMessageType["REFERRAL"] = "referral";
    DirectMessageType["CONSULTATION"] = "consultation";
    DirectMessageType["LAB_RESULT"] = "lab-result";
    DirectMessageType["IMAGING_RESULT"] = "imaging-result";
    DirectMessageType["DISCHARGE_SUMMARY"] = "discharge-summary";
    DirectMessageType["MEDICATION_RECONCILIATION"] = "medication-reconciliation";
    DirectMessageType["CARE_PLAN"] = "care-plan";
    DirectMessageType["APPOINTMENT_REMINDER"] = "appointment-reminder";
    DirectMessageType["SECURE_MESSAGE"] = "secure-message";
    DirectMessageType["NOTIFICATION"] = "notification";
    DirectMessageType["ACKNOWLEDGMENT"] = "acknowledgment";
    DirectMessageType["ERROR_NOTIFICATION"] = "error-notification";
})(DirectMessageType || (exports.DirectMessageType = DirectMessageType = {}));
var DirectMessagePriority;
(function (DirectMessagePriority) {
    DirectMessagePriority["LOW"] = "low";
    DirectMessagePriority["NORMAL"] = "normal";
    DirectMessagePriority["HIGH"] = "high";
    DirectMessagePriority["URGENT"] = "urgent";
})(DirectMessagePriority || (exports.DirectMessagePriority = DirectMessagePriority = {}));
var DirectMessageSensitivity;
(function (DirectMessageSensitivity) {
    DirectMessageSensitivity["NORMAL"] = "normal";
    DirectMessageSensitivity["CONFIDENTIAL"] = "confidential";
    DirectMessageSensitivity["RESTRICTED"] = "restricted";
    DirectMessageSensitivity["VERY_RESTRICTED"] = "very-restricted";
})(DirectMessageSensitivity || (exports.DirectMessageSensitivity = DirectMessageSensitivity = {}));
var DirectMessageStatus;
(function (DirectMessageStatus) {
    DirectMessageStatus["DRAFT"] = "draft";
    DirectMessageStatus["PENDING"] = "pending";
    DirectMessageStatus["ENCRYPTING"] = "encrypting";
    DirectMessageStatus["SIGNING"] = "signing";
    DirectMessageStatus["SENDING"] = "sending";
    DirectMessageStatus["SENT"] = "sent";
    DirectMessageStatus["DELIVERED"] = "delivered";
    DirectMessageStatus["READ"] = "read";
    DirectMessageStatus["ACKNOWLEDGED"] = "acknowledged";
    DirectMessageStatus["FAILED"] = "failed";
    DirectMessageStatus["REJECTED"] = "rejected";
    DirectMessageStatus["EXPIRED"] = "expired";
})(DirectMessageStatus || (exports.DirectMessageStatus = DirectMessageStatus = {}));
var DirectAcknowledgmentType;
(function (DirectAcknowledgmentType) {
    DirectAcknowledgmentType["DELIVERY"] = "delivery";
    DirectAcknowledgmentType["READ"] = "read";
    DirectAcknowledgmentType["PROCESSED"] = "processed";
    DirectAcknowledgmentType["ERROR"] = "error";
})(DirectAcknowledgmentType || (exports.DirectAcknowledgmentType = DirectAcknowledgmentType = {}));
var DirectAuditEventType;
(function (DirectAuditEventType) {
    DirectAuditEventType["MESSAGE_SENT"] = "message-sent";
    DirectAuditEventType["MESSAGE_RECEIVED"] = "message-received";
    DirectAuditEventType["MESSAGE_DELIVERED"] = "message-delivered";
    DirectAuditEventType["MESSAGE_FAILED"] = "message-failed";
    DirectAuditEventType["MESSAGE_QUARANTINED"] = "message-quarantined";
    DirectAuditEventType["CERTIFICATE_VALIDATED"] = "certificate-validated";
    DirectAuditEventType["CERTIFICATE_FAILED"] = "certificate-failed";
    DirectAuditEventType["ENCRYPTION_PERFORMED"] = "encryption-performed";
    DirectAuditEventType["DECRYPTION_PERFORMED"] = "decryption-performed";
    DirectAuditEventType["SIGNATURE_CREATED"] = "signature-created";
    DirectAuditEventType["SIGNATURE_VERIFIED"] = "signature-verified";
    DirectAuditEventType["TRUST_BUNDLE_UPDATED"] = "trust-bundle-updated";
    DirectAuditEventType["CONNECTION_ESTABLISHED"] = "connection-established";
    DirectAuditEventType["CONNECTION_FAILED"] = "connection-failed";
})(DirectAuditEventType || (exports.DirectAuditEventType = DirectAuditEventType = {}));
//# sourceMappingURL=direct.types.js.map