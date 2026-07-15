export interface NormalizedCashInRequest {
  requestId: string
  uid: string
  memberId: string
  fullName: string
  email: string

  amountCC: number
  amountPHP: number
  ratePHPPerCC: number

  requestedAt: string
  status: string

  paymentMethod: string
  referenceNumber: string
  proofOfPaymentUrl: string
}

type UnknownRecord = Record<string, unknown>

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function readFiniteNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : Number.NaN

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

export function normalizeCashInRequest(
  requestId: string,
  raw: UnknownRecord,
): NormalizedCashInRequest {
  return {
    requestId: readString(raw.requestId, raw.id, requestId) || requestId,

    uid: readString(raw.uid),
    memberId: readString(raw.memberId),
    fullName: readString(raw.fullName),
    email: readString(raw.email),

    amountCC: readFiniteNumber(raw.amountCC, raw.computedCC),

    amountPHP: readFiniteNumber(raw.amountPHP, raw.amountPhp),

    ratePHPPerCC: readFiniteNumber(raw.ratePHPPerCC, raw.purchaseRatePHP, 70),

    requestedAt: readString(
      raw.requestedAt,
      raw.requestDate,
      raw.createdAt,
      raw.updatedAt,
    ),

    status: readString(raw.status) || 'Pending',

    paymentMethod:
      readString(raw.paymentMethod, raw.paymentChannel) || 'Unknown',

    referenceNumber: readString(raw.referenceNumber) || 'Unavailable',

    proofOfPaymentUrl: readString(raw.proofOfPaymentUrl),
  }
}
