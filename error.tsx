"use client";
import { ErrorState } from "@/components/ui/card";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState message={process.env.NODE_ENV === "production" ? "Please try again in a moment." : error.message} onRetry={reset} />;
}
