const mongoose = require("mongoose");

const operationsAuditSchema = new mongoose.Schema({
  actor: { type: String, required: true, maxlength: 160 },
  action: { type: String, required: true, maxlength: 100, index: true },
  resourceType: { type: String, required: true, maxlength: 80 },
  resourceId: { type: String, default: "", maxlength: 100 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  occurredAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

operationsAuditSchema.index({ resourceType: 1, resourceId: 1, occurredAt: -1 });
module.exports = mongoose.model("OperationsAudit", operationsAuditSchema);
