"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  Mail,
  Sparkles,
  CircleCheck,
  LayoutDashboard,
  Users,
  ListTodo,
} from "lucide-react";
import styles from "./launcher.module.css";

const steps = [
  {
    title: "See what matters",
    label: "A new inquiry",
    caption: "The conversation, customer and next step come together in one workspace.",
    status: "Needs a reply",
  },
  {
    title: "Let AI prepare",
    label: "A reply, ready to review",
    caption: "AI uses the conversation to prepare a useful response. You review the details.",
    status: "Ready for review",
  },
  {
    title: "Move work forward",
    label: "A clear record of the result",
    caption: "Approved work stays connected to the customer, with a result you can check.",
    status: "Demo action complete",
  },
];

/** A bounded marketing illustration; real simulated operations live in the shared admin demo. */
export function DemoStory() {
  const [step, setStep] = useState(0);
  const currentStep = steps[step] ?? steps[0]!;
  return (
    <div className={styles.story}>
      <div className={styles.storyTop}>
        <span>
          <span className={styles.liveDot} /> COMMAND CENTER
        </span>
        <span>Interactive illustration</span>
      </div>
      <div className={styles.product}>
        <aside className={styles.miniNav} aria-hidden="true">
          <div className={styles.miniLogo}>
            a<span>↗</span>
          </div>
          <LayoutDashboard size={18} />
          <Users size={18} />
          <Mail size={18} />
          <ListTodo size={18} />
          <span className={styles.avatar}>EC</span>
        </aside>
        <div className={styles.productMain}>
          <div className={styles.productHeading}>
            <div>
              <span className={styles.eyebrow}>NORTHLINE ROOFING</span>
              <h2>Your next opportunity.</h2>
            </div>
            <span className={styles.demoPill}>DEMO</span>
          </div>
          <div className={styles.flow} aria-hidden="true">
            <span className={styles.flowActive}>
              <Mail size={14} /> Inquiry
            </span>
            <i />
            <span className={step >= 1 ? styles.flowActive : ""}>
              <Sparkles size={14} /> AI draft
            </span>
            <i />
            <span className={step === 2 ? styles.flowActive : ""}>
              <CheckCheck size={14} /> Result
            </span>
          </div>
          <div key={step} className={styles.storyPanel} id="demo-story-panel" aria-live="polite">
            <div className={styles.messageHeader}>
              <span className={styles.customerAvatar}>JM</span>
              <div>
                <strong>Jordan Mitchell</strong>
                <span>Roof inspection inquiry</span>
              </div>
              <Mail size={17} />
            </div>
            <p className={styles.message}>
              “We noticed a leak after the storm. Could someone take a look this week?”
            </p>
            <div className={styles.connector}>
              <ArrowDown size={16} />
              <span>
                {step === 0
                  ? "Connected to the customer’s history"
                  : step === 1
                    ? "Prepared with conversation context"
                    : "Reviewed and recorded"}
              </span>
            </div>
            <div className={styles.actionCard}>
              <div className={styles.actionTitle}>
                {step === 2 ? <CircleCheck size={18} /> : <Sparkles size={18} />}
                <strong>{currentStep.label}</strong>
                <span className={styles.actionStatus}>{currentStep.status}</span>
              </div>
              <p>
                {step === 0
                  ? "Jordan is asking about an inspection this week. Review the conversation and prepare a response."
                  : step === 1
                    ? "Hi Jordan, thanks for reaching out. Could you share the property address and a convenient time for us to discuss the inspection?"
                    : "The example reply is marked complete. The conversation and activity history show what happened next."}
              </p>
              <button
                type="button"
                className={styles.previewAction}
                onClick={() => setStep((step + 1) % 3)}
              >
                {step === 0
                  ? "Preview AI draft"
                  : step === 1
                    ? "Preview the result"
                    : "Replay example"}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div className={styles.productFooter}>
            <Check size={13} /> Fictional example · Explore the full workflow below
          </div>
        </div>
      </div>
      <div className={styles.storyControls} role="group" aria-label="Explore the example workflow">
        {steps.map((item, index) => (
          <button
            key={item.title}
            type="button"
            aria-pressed={step === index}
            aria-controls="demo-story-panel"
            onClick={() => setStep(index)}
          >
            <span>0{index + 1}</span>
            {item.title}
          </button>
        ))}
      </div>
      <p className={styles.storyCaption}>{currentStep.caption}</p>
    </div>
  );
}
