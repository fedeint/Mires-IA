import { TAKEAWAY_PACKAGING_RATE } from "./operational-ui-config.js";

const TAXED_TAKEAWAY_SOURCES = new Set(["salon", "whatsapp"]);

function roundAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function shouldApplyPackagingFee(source) {
  return TAXED_TAKEAWAY_SOURCES.has(String(source || "").trim().toLowerCase());
}

export function createTableOrder({
  sentToKitchen = false,
  items = [],
  serviceType = "salon",
  takeawayChannel = "Salon",
  documentType = "boleta",
  documentIssued = false,
  paymentConfirmed = false,
  paymentMethod = "",
  paymentLabel = "Pendiente",
  customerDocument = "",
  businessName = "",
  paymentBreakdown = [],
  linkedTakeawayId = null,
  syncedAt = null,
} = {}) {
  const packagingFeeRate = serviceType === "takeaway" && shouldApplyPackagingFee(takeawayChannel) ? TAKEAWAY_PACKAGING_RATE : 0;
  return {
    sentToKitchen,
    items,
    serviceType,
    takeawayChannel,
    documentType,
    documentIssued,
    paymentConfirmed,
    paymentMethod,
    paymentLabel,
    customerDocument,
    businessName,
    paymentBreakdown,
    packagingFeeRate,
    linkedTakeawayId,
    syncedAt,
  };
}

export function createDeliveryOrder(config) {
  return {
    documentType: "boleta",
    documentIssued: false,
    paymentConfirmed: false,
    paymentMethod: "",
    paymentLabel: "Pendiente",
    customerDocument: "",
    businessName: "",
    timeline: [],
    ...config,
    timeline: config.timeline || [config.status],
  };
}

export function createTakeawayOrder(config) {
  const source = config.source || config.channel || "Caja";
  const packagingFeeRate = config.packagingFeeRate ?? (shouldApplyPackagingFee(source) ? TAKEAWAY_PACKAGING_RATE : 0);
  const baseTotal = config.baseTotal ?? config.total ?? 0;
  const packagingFeeAmount = roundAmount(baseTotal * packagingFeeRate);
  const total = roundAmount(baseTotal + packagingFeeAmount);
  return {
    documentType: "boleta",
    documentIssued: false,
    paymentConfirmed: false,
    paymentMethod: "",
    paymentLabel: "Pendiente",
    source,
    baseTotal,
    packagingFeeRate,
    packagingFeeAmount,
    total,
    linkedTableId: null,
    customerDocument: "",
    businessName: "",
    timeline: [],
    ...config,
    baseTotal,
    packagingFeeRate,
    packagingFeeAmount,
    total,
    timeline: config.timeline || [config.status],
  };
}
