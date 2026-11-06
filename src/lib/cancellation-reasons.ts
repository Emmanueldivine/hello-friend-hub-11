import { z } from "zod";

export const CANCELLATION_REASONS = [
  { value: "wrong_details", label: "I entered the wrong assignment details" },
  { value: "no_longer_needed", label: "I no longer need this assignment" },
  { value: "deadline_or_price", label: "The deadline or price does not work for me" },
  { value: "service_issue", label: "I had a problem with Unieveryhelp — please contact me" },
] as const;

export const CANCELLATION_REASON_VALUES = CANCELLATION_REASONS.map((reason) => reason.value) as [
  (typeof CANCELLATION_REASONS)[number]["value"],
  (typeof CANCELLATION_REASONS)[number]["value"],
  (typeof CANCELLATION_REASONS)[number]["value"],
  (typeof CANCELLATION_REASONS)[number]["value"],
];

export const cancellationReasonSchema = z.enum(CANCELLATION_REASON_VALUES);
export type CancellationReason = z.infer<typeof cancellationReasonSchema>;

export function cancellationReasonLabel(value: string | null | undefined) {
  return CANCELLATION_REASONS.find((reason) => reason.value === value)?.label ?? value ?? "—";
}