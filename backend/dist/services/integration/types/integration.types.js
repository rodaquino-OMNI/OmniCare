"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationPattern = exports.MessageStatus = void 0;
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "pending";
    MessageStatus["PROCESSING"] = "processing";
    MessageStatus["PROCESSED"] = "processed";
    MessageStatus["FAILED"] = "failed";
    MessageStatus["RETRY"] = "retry";
    MessageStatus["CANCELLED"] = "cancelled";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
var IntegrationPattern;
(function (IntegrationPattern) {
    IntegrationPattern["REQUEST_RESPONSE"] = "request-response";
    IntegrationPattern["PUBLISH_SUBSCRIBE"] = "publish-subscribe";
    IntegrationPattern["MESSAGE_QUEUE"] = "message-queue";
    IntegrationPattern["BATCH_PROCESSING"] = "batch-processing";
    IntegrationPattern["STREAMING"] = "streaming";
    IntegrationPattern["WEBHOOK"] = "webhook";
})(IntegrationPattern || (exports.IntegrationPattern = IntegrationPattern = {}));
//# sourceMappingURL=integration.types.js.map