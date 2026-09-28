import type { AccountType, DecisionStatus, RiskLevel, Role } from '@prisma/client';
import type { RiskFlag } from '@fintech-demo/contracts';

/**
 * Deterministic, clearly fictional seed data. Customers and applicants are opaque handles,
 * merchants are invented, card numbers are last-4 only, and no real-world identifiers are used.
 */

export interface SeedUser {
  demoKey: 'viewer' | 'analyst' | 'admin';
  displayName: string;
  role: Role;
}

export const SEED_USERS: readonly SeedUser[] = [
  { demoKey: 'viewer', displayName: 'Demo Viewer', role: 'VIEWER' },
  { demoKey: 'analyst', displayName: 'Demo Ops Analyst', role: 'OPS_ANALYST' },
  { demoKey: 'admin', displayName: 'Demo Administrator', role: 'ADMIN' },
];

export interface SeedRefund {
  reference: string;
  status: DecisionStatus;
  amountCents: number;
  currency: string;
  customerLabel: string;
  requestReason: string;
  createdAt: string;
  transaction: {
    reference: string;
    merchantName: string;
    amountCents: number;
    cardLast4: string;
    occurredAt: string;
  };
  decision?: { byDemoKey: 'analyst' | 'admin'; decidedAt: string; reason: string | null };
}

const MERCHANTS = ['Northwind Cycles', 'Blue Harbor Books', 'Pixel & Pine Co.', 'Copperleaf Grocers', 'Summit Gear Outlet', 'Lumen Home Goods'];

function refund(index: number, overrides: Partial<SeedRefund> & Pick<SeedRefund, 'status' | 'requestReason'>): SeedRefund {
  const n = 1001 + index;
  const amountCents = 1250 + index * 1735;
  const day = String(2 + index).padStart(2, '0');
  const merchantName = MERCHANTS[index % MERCHANTS.length] ?? MERCHANTS[0] ?? 'Fictional Merchant';
  return {
    reference: `RF-${n}`,
    amountCents,
    currency: 'USD',
    customerLabel: `Customer C-${1040 + index * 7}`,
    createdAt: `2026-09-${day}T10:${String(10 + index).padStart(2, '0')}:00.000Z`,
    transaction: {
      reference: `TX-${90000 + index * 13}`,
      merchantName,
      amountCents: amountCents + (index % 3 === 0 ? 0 : 499),
      cardLast4: String(4100 + index * 37).slice(-4),
      occurredAt: `2026-08-${String(20 + (index % 8)).padStart(2, '0')}T14:${String(index * 5).padStart(2, '0')}:00.000Z`,
    },
    ...overrides,
  };
}

export const SEED_REFUNDS: readonly SeedRefund[] = [
  refund(0, { status: 'PENDING', requestReason: 'Duplicate charge for the same order' }),
  refund(1, { status: 'PENDING', requestReason: 'Item arrived damaged' }),
  refund(2, { status: 'PENDING', requestReason: 'Subscription cancelled before renewal' }),
  refund(3, { status: 'PENDING', requestReason: 'Order never delivered' }),
  refund(4, { status: 'PENDING', requestReason: 'Charged after trial ended without notice' }),
  refund(5, { status: 'PENDING', requestReason: 'Wrong size shipped' }),
  refund(6, {
    status: 'APPROVED',
    requestReason: 'Merchant confirmed the order was cancelled',
    decision: { byDemoKey: 'analyst', decidedAt: '2026-09-15T09:30:00.000Z', reason: 'Merchant confirmation attached' },
  }),
  refund(7, {
    status: 'REJECTED',
    requestReason: 'Changed my mind after delivery',
    decision: { byDemoKey: 'analyst', decidedAt: '2026-09-16T11:05:00.000Z', reason: 'Outside the return window' },
  }),
  refund(8, {
    status: 'APPROVED',
    requestReason: 'Charged twice for one booking',
    decision: { byDemoKey: 'admin', decidedAt: '2026-09-18T16:45:00.000Z', reason: null },
  }),
];

export interface SeedKycCase {
  reference: string;
  status: DecisionStatus;
  applicantLabel: string;
  accountType: AccountType;
  riskLevel: RiskLevel;
  riskFlags: RiskFlag[];
  notes: string;
  createdAt: string;
  decision?: { byDemoKey: 'analyst' | 'admin'; decidedAt: string; reason: string | null };
}

const FLAGS = {
  addressMismatch: { code: 'ADDRESS_MISMATCH', label: 'Declared address differs from document address', severity: 'MEDIUM' },
  velocity: { code: 'SIGNUP_VELOCITY', label: 'Several sign-ups from the same fictional device fingerprint', severity: 'HIGH' },
  pepScreen: { code: 'WATCHLIST_NEAR_MATCH', label: 'Near match on a synthetic watchlist entry', severity: 'HIGH' },
  docExpiry: { code: 'DOCUMENT_EXPIRING', label: 'Identity document expires within 30 days', severity: 'LOW' },
  newBusiness: { code: 'NEW_ENTITY', label: 'Business registered less than 90 days ago', severity: 'MEDIUM' },
  lowConfidence: { code: 'OCR_LOW_CONFIDENCE', label: 'Document OCR confidence below threshold', severity: 'LOW' },
} satisfies Record<string, RiskFlag>;

function kycCase(index: number, overrides: Pick<SeedKycCase, 'status' | 'riskLevel' | 'riskFlags' | 'accountType' | 'notes'> & Partial<SeedKycCase>): SeedKycCase {
  return {
    reference: `KYC-${2001 + index}`,
    applicantLabel: overrides.accountType === 'BUSINESS' ? `Business B-${3100 + index * 11}` : `Applicant A-${2000 + index * 9}`,
    createdAt: `2026-09-${String(3 + index).padStart(2, '0')}T08:${String(15 + index * 3).padStart(2, '0')}:00.000Z`,
    ...overrides,
  };
}

export const SEED_KYC_CASES: readonly SeedKycCase[] = [
  kycCase(0, { status: 'PENDING', accountType: 'INDIVIDUAL', riskLevel: 'LOW', riskFlags: [FLAGS.docExpiry], notes: 'Standard individual onboarding. Fictional document set passed synthetic checks.' }),
  kycCase(1, { status: 'PENDING', accountType: 'INDIVIDUAL', riskLevel: 'MEDIUM', riskFlags: [FLAGS.addressMismatch, FLAGS.lowConfidence], notes: 'Applicant re-uploaded proof of address once.' }),
  kycCase(2, { status: 'PENDING', accountType: 'BUSINESS', riskLevel: 'HIGH', riskFlags: [FLAGS.velocity, FLAGS.newBusiness], notes: 'Recently registered entity; multiple sign-up attempts within one hour.' }),
  kycCase(3, { status: 'PENDING', accountType: 'INDIVIDUAL', riskLevel: 'HIGH', riskFlags: [FLAGS.pepScreen], notes: 'Synthetic watchlist near match requires manual review.' }),
  kycCase(4, { status: 'PENDING', accountType: 'BUSINESS', riskLevel: 'MEDIUM', riskFlags: [FLAGS.newBusiness], notes: 'Ownership structure documented; single fictional director.' }),
  kycCase(5, { status: 'PENDING', accountType: 'INDIVIDUAL', riskLevel: 'LOW', riskFlags: [], notes: 'No flags raised by synthetic rules.' }),
  kycCase(6, {
    status: 'APPROVED', accountType: 'INDIVIDUAL', riskLevel: 'LOW', riskFlags: [FLAGS.lowConfidence], notes: 'Manual document check completed.',
    decision: { byDemoKey: 'analyst', decidedAt: '2026-09-14T10:00:00.000Z', reason: 'Document verified manually' },
  }),
  kycCase(7, {
    status: 'REJECTED', accountType: 'BUSINESS', riskLevel: 'HIGH', riskFlags: [FLAGS.velocity, FLAGS.pepScreen], notes: 'Could not resolve watchlist near match.',
    decision: { byDemoKey: 'admin', decidedAt: '2026-09-17T13:20:00.000Z', reason: 'Unresolved screening result' },
  }),
];

export interface SeedFeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
}

export const SEED_FEATURE_FLAGS: readonly SeedFeatureFlag[] = [
  { key: 'refunds.auto-approve-under-10', description: 'Simulate auto-approval for refund requests under $10 (display only).', enabled: false },
  { key: 'kyc.enhanced-review-queue', description: 'Route HIGH risk KYC cases to the enhanced review queue.', enabled: true },
  { key: 'console.dark-mode', description: 'Expose the dark theme toggle in the operations console.', enabled: false },
  { key: 'payments.instant-payouts', description: 'Show the instant payouts option to eligible fictional merchants.', enabled: true },
  { key: 'ops.bulk-actions', description: 'Enable bulk approve/reject controls in list views.', enabled: false },
];
