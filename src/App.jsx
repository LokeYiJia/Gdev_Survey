import React, { useRef, useState } from "react";

const INSURANCE_PLANS = [
  "Medical Card",
  "Life / Term",
  "Critical Illness",
  "Savings",
  "Legacy",
  "Not sure",
  "I don’t have one",
];
const FINANCIAL_PRIORITIES = [
  "Plan for kids’ education",
  "Build emergency fund",
  "Retirement savings",
  "Increase my savings",
  "Venture into investment",
  "Manage my debts better",
  "Reduce medical expenses risk",
  "Protect income if I cannot work",
  "Plan for legacy / estate planning",
  "Review and optimize current policies",
  "Accident and disability coverage",
  "Critical illness planning",
];

const initialForm = {
  fullName: "",
  mobileNumber: "",
  icNumber: "",
  participantType: "",
  currentInsuranceCompany: "",
  existingInsurancePlans: [],
  financialPriorities: [],
  consent: false,
};

function ChoiceGroup({ legend, name, options, value, onChange, required = true }) {
  return (
    <fieldset className="choice-group">
      <legend>
        {legend} {required && <span aria-hidden="true">*</span>}
      </legend>
      <div className="choices">
        {options.map((option) => (
          <label className="choice" key={option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={onChange}
              required={required}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckboxGroup({ legend, name, options, values, onChange }) {
  return (
    <fieldset className="choice-group">
      <legend>
        {legend} <span aria-hidden="true">*</span>
      </legend>
      <div className="choices checkbox-grid">
        {options.map((option) => (
          <label className="choice" key={option}>
            <input
              type="checkbox"
              name={name}
              value={option}
              checked={values.includes(option)}
              onChange={onChange}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const update = ({ target }) => {
    const { name, value, type, checked } = target;
    const nextValue =
      name === "icNumber" ? value.replace(/\D/g, "").slice(0, 12) : value;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : nextValue,
    }));
  };

  const updateArray = ({ target }) => {
    const { name, value, checked } = target;
    setForm((current) => ({
      ...current,
      [name]: checked
        ? [...current[name], value]
        : current[name].filter((item) => item !== value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;

    if (!form.existingInsurancePlans.length || !form.financialPriorities.length) {
      setStatus({
        type: "error",
        message: "Select at least one insurance plan and one financial priority.",
      });
      return;
    }

    const icDigits = form.icNumber.replace(/\D/g, "");
    if (icDigits.length !== 12) {
      setStatus({ type: "error", message: "Please enter exactly 12 digits for the IC number." });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setStatus({ type: "loading", message: "Submitting your survey…" });

    const now = new Date();
    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const payload = {
      date: localDate,
      fullName: form.fullName,
      mobileNumber: form.mobileNumber,
      icNum: icDigits,
      agentName: "",
      agentId: "",
      gmName: "",
      currentInsuranceCompany: form.currentInsuranceCompany,
      existingInsurancePlans: form.existingInsurancePlans,
      financialPriorities: form.financialPriorities,
      participantType: form.participantType,
      consent: form.consent,
    };

    try {
      const response = await fetch("/api/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "Unable to submit the survey. Please try again.");
      }
      setForm(initialForm);
      setStatus({
        type: "success",
        message: "Survey submitted successfully. Thank you.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Unable to submit the survey. Please try again.",
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <form
        className="survey"
        onSubmit={handleSubmit}
        autoComplete="off"
        noValidate={false}
      >
        <header className="survey-header">
          <h1>Free Health Check Registration</h1>
        </header>

        <div className="form-layout">
        <section>
          <h2>1. Personal Details</h2>
          <div className="field-grid">
            <label className="field full-width">
              <span>Full Name *</span>
              <input name="fullName" value={form.fullName} onChange={update} required maxLength="100" autoComplete="off" />
            </label>
            <label className="field">
              <span>Mobile Number *</span>
              <input name="mobileNumber" value={form.mobileNumber} onChange={update} required maxLength="25" inputMode="tel" autoComplete="off" />
            </label>
            <label className="field">
              <span>IC Number (full number) *</span>
              <input name="icNumber" value={form.icNumber} onChange={update} required pattern="[0-9]{12}" title="Enter exactly 12 digits" maxLength="12" inputMode="numeric" autoComplete="off" />
            </label>
            <div className="full-width">
              <ChoiceGroup
                legend="Who are you?"
                name="participantType"
                options={["Great Eastern Staff", "GDG KL Participant"]}
                value={form.participantType}
                onChange={update}
              />
            </div>
            <label className="field full-width">
              <span>Current Insurance Company</span>
              <input name="currentInsuranceCompany" value={form.currentInsuranceCompany} onChange={update} maxLength="100" autoComplete="off" />
            </label>
          </div>
        </section>

        <section>
          <h2>2. Your Profile</h2>
          <CheckboxGroup legend="Existing Insurance Plans" name="existingInsurancePlans" options={INSURANCE_PLANS} values={form.existingInsurancePlans} onChange={updateArray} />
          <CheckboxGroup legend="Financial Priorities in the next 12 months" name="financialPriorities" options={FINANCIAL_PRIORITIES} values={form.financialPriorities} onChange={updateArray} />
        </section>

        <section>
          <h2>3. Consent &amp; Submission</h2>
          <label className="consent">
            <input type="checkbox" name="consent" checked={form.consent} onChange={update} required />
            <span>By participating in this survey and submitting your personal data, you consent to the collection, use, processing, and disclosure of your personal data for follow-up and advisory purposes.</span>
          </label>
        </section>
        </div>

        <footer className="survey-footer">
          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Survey"}
          </button>
          {status.message && (
            <p className={`status ${status.type}`} role={status.type === "error" ? "alert" : "status"} aria-live="polite">
              {status.message}
            </p>
          )}
        </footer>
      </form>
    </main>
  );
}
