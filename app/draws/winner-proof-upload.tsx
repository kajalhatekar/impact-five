"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type WinnerProofUploadProps = {
  winnerId: string;
  verificationStatus: string;
  payoutStatus: string;
  hasProof: boolean;
};

type UploadResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

/**
 * Subscriber-side proof upload for draw winners.
 *
 * Uploads are only useful while verification is pending or rejected; approved
 * or paid prizes are locked so winners cannot replace proof after completion.
 */
export default function WinnerProofUpload({
  winnerId,
  verificationStatus,
  payoutStatus,
  hasProof,
}: WinnerProofUploadProps) {
  const router = useRouter();

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [isUploading, setIsUploading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const verificationApproved =
    verificationStatus === "approved";

  const prizePaid = payoutStatus === "paid";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!selectedFile) {
      setErrorMessage(
        "Please select a JPG, PNG, WebP or PDF file.",
      );

      return;
    }

    const formData = new FormData();

    formData.append("winnerId", winnerId);
    formData.append("proof", selectedFile);

    setIsUploading(true);

    try {
      const response = await fetch(
        "/api/winners/proof",
        {
          method: "POST",
          body: formData,
        },
      );

      const result =
        (await response.json()) as UploadResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "The proof could not be uploaded.",
        );

        return;
      }

      setSuccessMessage(
        result.message ??
          "Proof uploaded successfully.",
      );

      setSelectedFile(null);

      router.refresh();
    } catch (error) {
      console.error(
        "Winner proof upload request failed:",
        error,
      );

      setErrorMessage(
        "Unable to upload the proof. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (verificationApproved || prizePaid) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-300 bg-white/70 p-4">
        <p className="font-semibold text-emerald-900">
          {prizePaid
            ? "Your prize has been paid."
            : "Your proof has been approved."}
        </p>

        <p className="mt-1 text-sm text-emerald-800">
          No further document upload is required.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 rounded-xl border border-emerald-300 bg-white/70 p-4"
    >
      <p className="font-semibold text-emerald-950">
        {hasProof
          ? verificationStatus === "rejected"
            ? "Submit a new proof"
            : "Proof submitted"
          : "Upload winner proof"}
      </p>

      <p className="mt-1 text-sm leading-6 text-emerald-800">
        Upload a JPG, PNG, WebP or PDF file. Maximum size:
        5 MB.
      </p>

      {hasProof &&
        verificationStatus === "pending" && (
          <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
            Your proof is waiting for administrator review.
          </p>
        )}

      {verificationStatus === "rejected" && (
        <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
          Your previous proof was rejected. Please upload
          another document.
        </p>
      )}

      <input
        key={successMessage}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        disabled={isUploading}
        onChange={(event) => {
          setSelectedFile(
            event.target.files?.[0] ?? null,
          );

          setErrorMessage("");
          setSuccessMessage("");
        }}
        className="mt-4 block w-full cursor-pointer rounded-xl border border-emerald-300 bg-white p-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      />

      {selectedFile && (
        <p className="mt-2 text-xs text-emerald-800">
          Selected: {selectedFile.name}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 text-sm font-semibold text-red-700"
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          role="status"
          className="mt-3 text-sm font-semibold text-emerald-800"
        >
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isUploading || !selectedFile}
        className="mt-4 w-full rounded-full bg-emerald-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isUploading
          ? "Uploading proof..."
          : hasProof
            ? "Replace proof"
            : "Submit proof"}
      </button>
    </form>
  );
}
