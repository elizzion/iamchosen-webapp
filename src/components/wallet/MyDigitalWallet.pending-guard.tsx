import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import {
  ArrowLeft,
  ArrowUpRight,
  FileCheck2,
  UploadCloud,
  Wallet as WalletIcon,
} from "lucide-react";

import { db } from "../../firebase";
import type { UserProfile, Wallet as WalletType } from "../../types";
import { useCCSettings } from "../../context/CCSettingsContext";
import { WalletService } from "../../services/wallet/wallet.service";
import AnimatedButton from "../customer/AnimatedButton";
import RecentActivityCard from "../customer/RecentActivityCard";
import SectionTitle from "../customer/SectionTitle";

interface MyDigitalWalletProps {
  userProfile: UserProfile;
  wallet: WalletType | null;
  cashinHistory?: unknown[];
  cashoutHistory?: unknown[];
  orders?: unknown[];
  commissionHistory?: unknown[];
  p2pReceivedHistory?: unknown[];
  p2pSentHistory?: unknown[];
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onBack?: () => void;
  className?: string;
}

interface CashInSettings {
  purchaseRatePHP?: number;
  cashInRatePHP?: number;
  displayReferenceRatePHP?: number;
}

const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;

type CashInRecord = Record<string, unknown>;

function toCashInRecord(value: unknown): CashInRecord {
  return typeof value === "object" && value !== null
    ? (value as CashInRecord)
    : {};
}

function readText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function readAmount(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function isPendingCashIn(value: unknown): boolean {
  const record = toCashInRecord(value);
  return readText(record.status).toLowerCase() === "pending";
}

function readPositiveNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 70;
}

export default function MyDigitalWallet({
  userProfile,
  wallet,
  cashinHistory = [],
  cashoutHistory = [],
  orders = [],
  commissionHistory = [],
  p2pReceivedHistory = [],
  p2pSentHistory = [],
  isLoading = false,
  onRefresh,
  onBack,
  className = "",
}: MyDigitalWalletProps) {
  const { ccSettings } = useCCSettings();
  const settings = ccSettings as unknown as CashInSettings;

  const cashInRatePHP = readPositiveNumber(
    settings.purchaseRatePHP,
    settings.cashInRatePHP,
  );

  const displayReferenceRatePHP = readPositiveNumber(
    settings.displayReferenceRatePHP,
    settings.purchaseRatePHP,
    settings.cashInRatePHP,
  );

  const [cashinAmountPhp, setCashinAmountPhp] = useState(3500);
  const [cashinChannel, setCashinChannel] = useState<"GCash" | "Maya" | "Bank">(
    "GCash",
  );
  const [cashinReference, setCashinReference] = useState("");
  const [cashinAccountName, setCashinAccountName] = useState("");
  const [cashinAccountNumber, setCashinAccountNumber] = useState("");
  const [cashinNotes, setCashinNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashinError, setCashinError] = useState<string | null>(null);
  const [cashinSuccess, setCashinSuccess] = useState<string | null>(null);
  const [optimisticPendingCashIn, setOptimisticPendingCashIn] =
    useState<CashInRecord | null>(null);

  const pendingCashInFromHistory = useMemo(
    () => cashinHistory.map(toCashInRecord).find(isPendingCashIn) ?? null,
    [cashinHistory],
  );

  const pendingCashInRequest =
    pendingCashInFromHistory ?? optimisticPendingCashIn;

  const hasPendingCashInRequest = pendingCashInRequest !== null;

  useEffect(() => {
    if (!optimisticPendingCashIn) return;

    const optimisticId = readText(
      optimisticPendingCashIn.requestId,
      optimisticPendingCashIn.id,
    );

    const matchingHistoryRecord = cashinHistory
      .map(toCashInRecord)
      .find((record) => readText(record.requestId, record.id) === optimisticId);

    if (matchingHistoryRecord) {
      setOptimisticPendingCashIn(null);
    }
  }, [cashinHistory, optimisticPendingCashIn]);

  const computedCC = useMemo(
    () => Number((cashinAmountPhp / cashInRatePHP).toFixed(4)),
    [cashInRatePHP, cashinAmountPhp],
  );

  const phpReference =
    (wallet?.chosenWalletBalance ?? 0) * displayReferenceRatePHP;

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewUrl]);

  const resetForm = (): void => {
    if (receiptPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }

    setCashinReference("");
    setCashinAccountName("");
    setCashinAccountNumber("");
    setCashinNotes("");
    setReceiptFile(null);
    setReceiptPreviewUrl("");
  };

  const handleFile = (file: File): void => {
    const isSupportedType =
      file.type.startsWith("image/") || file.type === "application/pdf";

    if (!isSupportedType) {
      setCashinError(
        "Invalid file type. Upload a JPG, PNG, WebP, or PDF receipt.",
      );
      return;
    }

    if (file.size > MAX_RECEIPT_SIZE_BYTES) {
      setCashinError("The receipt must not exceed 5 MB.");
      return;
    }

    if (receiptPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }

    setReceiptFile(file);
    setReceiptPreviewUrl(URL.createObjectURL(file));
    setCashinError(null);
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleCashinSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setCashinError(null);
    setCashinSuccess(null);

    if (hasPendingCashInRequest) {
      setCashinError(
        "You already have a pending Cash-In request. Wait for it to be approved or rejected before submitting another request.",
      );
      return;
    }

    if (cashinAmountPhp < cashInRatePHP) {
      setCashinError(
        `The minimum Cash-In is ₱${cashInRatePHP.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} (1 CC).`,
      );
      return;
    }

    if (!cashinAccountName.trim() || !cashinAccountNumber.trim()) {
      setCashinError(
        "Your sender account name and account number are required.",
      );
      return;
    }

    if (!cashinReference.trim()) {
      setCashinError("The transaction reference number is required.");
      return;
    }

    if (!receiptFile) {
      setCashinError("Upload a proof-of-payment receipt before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const existingPendingQuery = query(
        collection(db, "cashin_requests"),
        where("uid", "==", userProfile.uid),
        where("status", "==", "Pending"),
        limit(1),
      );

      const existingPendingSnapshot = await getDocs(existingPendingQuery);

      if (!existingPendingSnapshot.empty) {
        const existingDoc = existingPendingSnapshot.docs[0];
        setOptimisticPendingCashIn({
          id: existingDoc.id,
          ...existingDoc.data(),
        });
        setCashinError(
          "You already have a pending Cash-In request. Wait for it to be approved or rejected before submitting another request.",
        );
        return;
      }

      const requestId = `CI-${Date.now()}-${Math.floor(
        100 + Math.random() * 900,
      )}`;

      const uploadResult = await WalletService.uploadReceipt(
        userProfile.uid,
        requestId,
        receiptFile,
      );

      const requestPayload = {
        requestId,
        memberId: userProfile.memberId,
        fullName: userProfile.fullName,
        email: userProfile.email,
        amountPHP: Number(cashinAmountPhp),
        computedCC,
        paymentMethod:
          cashinChannel === "Bank" ? "Bank Transfer" : cashinChannel,
        paymentChannel: cashinChannel,
        referenceNumber: cashinReference.trim(),
        proofOfPaymentUrl: uploadResult.proofOfPaymentUrl,
        proofOfPaymentPath: uploadResult.proofOfPaymentPath,
        proofOfPaymentFileName: uploadResult.proofOfPaymentFileName,
        proofOfPaymentContentType: uploadResult.proofOfPaymentContentType,
        proofOfPaymentSizeBytes: uploadResult.proofOfPaymentSizeBytes,
        senderAccountName: cashinAccountName.trim(),
        senderAccountNumber: cashinAccountNumber.trim(),
        accountName: cashinAccountName.trim(),
        accountNumber: cashinAccountNumber.trim(),
        notes: cashinNotes.trim(),
      };

      await WalletService.createCashInRequest(userProfile.uid, requestPayload);

      setOptimisticPendingCashIn({
        ...requestPayload,
        uid: userProfile.uid,
        status: "Pending",
        requestedAt: new Date().toISOString(),
      });

      setCashinSuccess(
        `Cash-In request submitted: ₱${cashinAmountPhp.toLocaleString(
          "en-PH",
        )} for ${computedCC.toFixed(4)} CC.`,
      );

      resetForm();
      await onRefresh?.();
    } catch (error) {
      console.error("Unable to submit Cash-In request:", error);
      setCashinError(
        error instanceof Error
          ? error.message
          : "The Cash-In request could not be submitted.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={["space-y-6", className].join(" ")}>
      <div className="flex items-start gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Return to Affiliate Dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-[#17181D] text-zinc-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <SectionTitle
          title="My Digital Wallet"
          subtitle="Deposit funds, verify ledgers and check histories"
          icon={<WalletIcon className="h-4.5 w-4.5 text-cyan-400" />}
        />
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-[#1E202A] to-[#0F1015] p-6">
        <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-400">
          Total Assets Balance
        </span>

        <h2 className="mt-4 text-4xl font-black leading-none tracking-tight text-white tabular-nums">
          {isLoading
            ? "—"
            : (wallet?.chosenWalletBalance ?? 0).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
          <span className="text-sm font-extrabold text-zinc-500">CC</span>
        </h2>

        <span className="mt-2 block text-xs text-[#F4C542] tabular-nums">
          ≈{" "}
          {new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(phpReference)}{" "}
          PHP
        </span>
      </div>

      <div
        id="cashin-form-section"
        className="space-y-5 rounded-3xl border border-zinc-800 bg-[#1D1F26] p-6"
      >
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight text-white">
            <ArrowUpRight className="h-4.5 w-4.5 text-[#F4C542]" />
            Top Up Wallet via Cash-In
          </h3>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
            Cash-In Rate: 1 CC = ₱{cashInRatePHP.toFixed(2)} | Secure corporate
            deposit channels
          </p>
        </div>

        {hasPendingCashInRequest && pendingCashInRequest && (
          <div
            role="status"
            className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-300"
          >
            <div className="font-extrabold uppercase tracking-wide text-amber-200">
              Cash-In temporarily locked
            </div>
            <p className="mt-1 leading-relaxed text-amber-200/80">
              You already have a pending Cash-In request. You can submit a new
              request only after the current request is approved or rejected.
            </p>
            <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
              <span>
                Request ID:{" "}
                <strong className="tabular-nums">
                  {readText(
                    pendingCashInRequest.requestId,
                    pendingCashInRequest.id,
                  ) || "Pending request"}
                </strong>
              </span>
              <span>
                Requested amount:{" "}
                <strong className="tabular-nums">
                  {readAmount(
                    pendingCashInRequest.computedCC,
                    pendingCashInRequest.amountCC,
                  ).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}{" "}
                  CC
                </strong>
              </span>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="mt-3 rounded-xl border border-amber-400/25 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-amber-200 transition-colors hover:bg-amber-400/10"
              >
                Refresh Request Status
              </button>
            )}
          </div>
        )}

        {cashinError && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400"
          >
            {cashinError}
          </div>
        )}

        {cashinSuccess && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-400"
          >
            {cashinSuccess}
          </div>
        )}

        {!hasPendingCashInRequest && (
          <form onSubmit={handleCashinSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Amount in Philippine Pesos (PHP)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                  ₱
                </span>
                <input
                  type="number"
                  required
                  min={cashInRatePHP}
                  step="1"
                  value={cashinAmountPhp}
                  onChange={(event) =>
                    setCashinAmountPhp(Number(event.target.value))
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-[#0B0B0F] py-3 pl-8 pr-4 text-sm font-bold text-white tabular-nums transition-colors focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5 rounded-2xl border border-zinc-800/80 bg-[#0B0B0F]/80 p-4 text-xs">
              <span className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                Computed Credits Ledger
              </span>
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500">Corporate Exchange Rate:</span>
                <span className="text-zinc-300">
                  1 CC = ₱{cashInRatePHP.toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-zinc-800/80 pt-2 text-xs font-bold">
                <span className="text-[#F4C542]">Credit Output (CC):</span>
                <span className="text-[#F4C542] tabular-nums">
                  {computedCC.toFixed(4)} CC
                </span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Company Payment Target Channel
              </label>
              <select
                value={cashinChannel}
                onChange={(event) =>
                  setCashinChannel(
                    event.target.value as "GCash" | "Maya" | "Bank",
                  )
                }
                className="w-full cursor-pointer rounded-xl border border-zinc-800 bg-[#0B0B0F] px-3 py-3 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="GCash">GCash (Company Account)</option>
                <option value="Maya">Maya (Company Account)</option>
                <option value="Bank">Bank Transfer (Company Account)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Your Account Name
                </label>
                <input
                  type="text"
                  required
                  value={cashinAccountName}
                  onChange={(event) => setCashinAccountName(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-[#0B0B0F] px-4 py-3 text-xs text-white transition-colors focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Your Account Number
                </label>
                <input
                  type="text"
                  required
                  value={cashinAccountNumber}
                  onChange={(event) =>
                    setCashinAccountNumber(event.target.value)
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-[#0B0B0F] px-4 py-3 text-xs text-white transition-colors focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Transaction Reference Number
              </label>
              <input
                type="text"
                required
                value={cashinReference}
                onChange={(event) => setCashinReference(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-[#0B0B0F] px-4 py-3 text-xs text-white transition-colors focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Upload Proof of Payment Receipt (Required)
              </label>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() =>
                  document.getElementById("shared-cashin-file-upload")?.click()
                }
                className={[
                  "cursor-pointer rounded-2xl border border-dashed p-6 text-center transition-all",
                  isDragging
                    ? "border-cyan-400 bg-cyan-500/5"
                    : receiptPreviewUrl
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-zinc-800 hover:border-cyan-500/40",
                ].join(" ")}
              >
                <input
                  id="shared-cashin-file-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {receiptPreviewUrl ? (
                  <div className="space-y-2">
                    {receiptFile?.type === "application/pdf" ? (
                      <FileCheck2 className="mx-auto h-8 w-8 text-emerald-400" />
                    ) : (
                      <img
                        src={receiptPreviewUrl}
                        alt="Receipt preview"
                        className="mx-auto max-h-28 rounded-xl border border-zinc-800 object-contain"
                      />
                    )}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Tap or drop another file to replace the receipt
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 py-2">
                    <UploadCloud className="mx-auto h-7 w-7 text-cyan-400" />
                    <div className="text-xs font-extrabold text-zinc-300">
                      Drag and drop receipt here
                    </div>
                    <div className="text-[10px] font-light text-zinc-500">
                      or click to browse from your device
                    </div>
                    <div className="text-[9px] uppercase tracking-wide text-zinc-600">
                      JPG, PNG, WebP, or PDF — maximum 5 MB
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Additional Notes (Optional)
              </label>
              <textarea
                value={cashinNotes}
                onChange={(event) => setCashinNotes(event.target.value)}
                className="h-16 w-full resize-none rounded-xl border border-zinc-800 bg-[#0B0B0F] px-4 py-3 text-xs text-white transition-colors focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <AnimatedButton
              type="submit"
              variant="gold"
              disabled={isSubmitting}
              fullWidth
            >
              {isSubmitting ? "Processing..." : "Submit Cash-In Request"}
            </AnimatedButton>
          </form>
        )}
      </div>

      <RecentActivityCard
        cashins={cashinHistory}
        cashouts={cashoutHistory}
        orders={orders}
        commissions={commissionHistory}
        p2pReceived={p2pReceivedHistory}
        p2pSent={p2pSentHistory}
        currentUid={userProfile.uid}
        accountType={
          userProfile.accountType as "Customer" | "Smart Customer" | "Affiliate"
        }
        layoutVariant={
          userProfile.accountType === "Affiliate" ? "wide" : "compact"
        }
        pageSize={userProfile.accountType === "Affiliate" ? 6 : 3}
      />
    </section>
  );
}
