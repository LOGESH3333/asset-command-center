"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}

interface StepFormProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  children: ReactNode;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

export function StepForm({
  steps,
  currentStep,
  onStepChange,
  children,
  onSubmit,
  submitting,
  submitLabel = "Submit",
}: StepFormProps) {
  return (
    <div className="space-y-8">
      {/* Progress indicator */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => idx <= currentStep && onStepChange(idx)}
                className={cn(
                  "flex flex-col items-center gap-2 transition-opacity",
                  idx > currentStep && "opacity-40"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold transition-all",
                    idx < currentStep
                      ? "bg-emerald-500 text-white"
                      : idx === currentStep
                      ? "bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg shadow-primary/25"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {idx < currentStep ? <Check className="h-5 w-5" /> : idx + 1}
                </div>
                <div className="hidden text-center sm:block">
                  <p className="text-xs font-semibold">{step.title}</p>
                  {step.description && (
                    <p className="text-[10px] text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </button>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                    idx < currentStep ? "bg-emerald-500" : "bg-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          Previous
        </button>
        {currentStep < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => onStepChange(currentStep + 1)}
            className="rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-lg shadow-primary/20"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-lg shadow-primary/20 disabled:opacity-60"
          >
            {submitting ? "Saving..." : submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
