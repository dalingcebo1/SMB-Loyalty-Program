import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import api from '../../../api/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrandingData {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  tagline: string;
}

interface LoyaltyData {
  points_per_rand: number;
  visit_milestone: number;
  reward_description: string;
}

interface ServiceItem {
  name: string;
  price_cents: number;
}

interface TeamInvite {
  email: string;
}

interface WizardState {
  // Step 1
  business_name: string;
  business_type: string;
  phone: string;
  email: string;
  address: string;
  // Step 2
  branding: BrandingData;
  // Step 3
  verticals: string[];
  // Step 4
  loyalty: LoyaltyData;
  // Step 5
  services: ServiceItem[];
  // Step 6
  team_invites: TeamInvite[];
}

const VERTICALS = [
  { value: 'carwash', label: 'Car Wash', desc: 'Vehicle wash and detailing services' },
  { value: 'retail', label: 'Retail / POS', desc: 'Point-of-sale and inventory management' },
  { value: 'beauty', label: 'Beauty Salon', desc: 'Hair, nail, and beauty treatments' },
  { value: 'padel', label: 'Padel Courts', desc: 'Court booking and coaching management' },
  { value: 'flowershop', label: 'Flower Shop', desc: 'Bouquets, arrangements, and deliveries' },
  { value: 'dispensary', label: 'Dispensary', desc: 'Product catalog with compliance tracking' },
];

const STEPS = [
  'Business Info',
  'Branding',
  'Choose Verticals',
  'Loyalty Program',
  'Add Services',
  'Invite Team',
];

const INITIAL_STATE: WizardState = {
  business_name: '',
  business_type: '',
  phone: '',
  email: '',
  address: '',
  branding: { logo_url: '', primary_color: '#3366ff', secondary_color: '#f8fafc', tagline: '' },
  verticals: [],
  loyalty: { points_per_rand: 1, visit_milestone: 5, reward_description: 'Free service after milestone' },
  services: [{ name: '', price_cents: 0 }],
  team_invites: [{ email: '' }],
};

// ─── Component ──────────────────────────────────────────────────────────────

const OnboardingWizard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tenantId = user?.tenant_id;

  const updateField = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        business_name: data.business_name || undefined,
        business_type: data.business_type || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
      };
      if (data.branding.logo_url || data.branding.primary_color || data.branding.tagline) {
        payload.branding = {
          logo_url: data.branding.logo_url || undefined,
          primary_color: data.branding.primary_color || undefined,
          secondary_color: data.branding.secondary_color || undefined,
          tagline: data.branding.tagline || undefined,
        };
      }
      if (data.verticals.length > 0) {
        payload.verticals = data.verticals;
      }
      payload.loyalty = {
        points_per_rand: data.loyalty.points_per_rand,
        visit_milestone: data.loyalty.visit_milestone,
        reward_description: data.loyalty.reward_description || undefined,
      };
      const validServices = data.services.filter((s) => s.name.trim() && s.price_cents > 0);
      if (validServices.length > 0) {
        payload.services = validServices;
      }
      const validInvites = data.team_invites.filter((i) => i.email.trim());
      if (validInvites.length > 0) {
        payload.team_invites = validInvites;
      }

      await api.patch(`/tenants/${tenantId}/onboarding`, payload);
      window.dispatchEvent(new Event('tenant-theme:refresh'));
      setSuccess(true);
      setTimeout(() => navigate('/admin'), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete setup';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success Screen ───────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
          <p className="text-gray-600">
            Your business is ready to go. Redirecting to your dashboard…
          </p>
        </div>
      </div>
    );
  }

  // ─── Wizard Layout ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Set Up Your Business</h1>
          <p className="text-gray-500 mt-1">Complete these steps to get started (~2 min)</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-1 mb-8" role="navigation" aria-label="Wizard progress">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  i < step
                    ? 'bg-green-500 text-white'
                    : i === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
                aria-current={i === step ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${label}`}
              >
                {i < step ? '✓' : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-6 sm:w-10 h-0.5 mx-0.5 ${
                    i < step ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 mb-6">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>

        {/* Step Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {step === 0 && <StepBusinessInfo data={data} updateField={updateField} />}
          {step === 1 && <StepBranding data={data} updateField={updateField} />}
          {step === 2 && <StepVerticals data={data} updateField={updateField} />}
          {step === 3 && <StepLoyalty data={data} updateField={updateField} />}
          {step === 4 && <StepServices data={data} updateField={updateField} />}
          {step === 5 && <StepTeam data={data} updateField={updateField} />}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={prev}
              disabled={step === 0}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Back
            </button>
            <div className="flex gap-3">
              {step >= 4 && step < STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={next}
                  className="px-5 py-2.5 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Skip
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors font-medium"
                >
                  {submitting ? 'Saving…' : 'Complete Setup'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Re-access hint */}
        <p className="text-center text-xs text-gray-400 mt-6">
          You can re-access this wizard later from Admin &gt; Settings.
        </p>
      </div>
    </div>
  );
};

// ─── Step Components ────────────────────────────────────────────────────────

interface StepProps {
  data: WizardState;
  updateField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

function StepBusinessInfo({ data, updateField }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
      <div>
        <label className={labelCls}>Business Name *</label>
        <input
          className={inputCls}
          placeholder="e.g. Sunshine Car Wash"
          value={data.business_name}
          onChange={(e) => updateField('business_name', e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls}>Industry / Type</label>
        <select
          className={inputCls}
          value={data.business_type}
          onChange={(e) => updateField('business_type', e.target.value)}
        >
          <option value="">Select…</option>
          {VERTICALS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Phone</label>
          <input
            className={inputCls}
            placeholder="012 345 6789"
            value={data.phone}
            onChange={(e) => updateField('phone', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            className={inputCls}
            type="email"
            placeholder="info@mybusiness.co.za"
            value={data.email}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Address</label>
        <input
          className={inputCls}
          placeholder="123 Main Rd, Johannesburg"
          value={data.address}
          onChange={(e) => updateField('address', e.target.value)}
        />
      </div>
    </div>
  );
}

function StepBranding({ data, updateField }: StepProps) {
  const b = data.branding;
  const update = (key: keyof BrandingData, value: string) =>
    updateField('branding', { ...b, [key]: value });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
      <div>
        <label className={labelCls}>Logo URL</label>
        <input
          className={inputCls}
          placeholder="https://example.com/logo.png"
          value={b.logo_url}
          onChange={(e) => update('logo_url', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Primary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={b.primary_color}
              onChange={(e) => update('primary_color', e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
            />
            <input
              className={inputCls}
              value={b.primary_color}
              onChange={(e) => update('primary_color', e.target.value)}
              maxLength={7}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Secondary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={b.secondary_color}
              onChange={(e) => update('secondary_color', e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
            />
            <input
              className={inputCls}
              value={b.secondary_color}
              onChange={(e) => update('secondary_color', e.target.value)}
              maxLength={7}
            />
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls}>Tagline</label>
        <input
          className={inputCls}
          placeholder="e.g. The best car wash in town"
          value={b.tagline}
          onChange={(e) => update('tagline', e.target.value)}
        />
      </div>
    </div>
  );
}

function StepVerticals({ data, updateField }: StepProps) {
  const toggle = (v: string) => {
    const current = data.verticals;
    if (current.includes(v)) {
      updateField(
        'verticals',
        current.filter((x) => x !== v),
      );
    } else {
      updateField('verticals', [...current, v]);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Choose Your Business Modules</h2>
      <p className="text-sm text-gray-500">Select the modules relevant to your business.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VERTICALS.map((v) => {
          const selected = data.verticals.includes(v.value);
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => toggle(v.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{v.label}</div>
              <div className="text-xs text-gray-500 mt-1">{v.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepLoyalty({ data, updateField }: StepProps) {
  const l = data.loyalty;
  const update = (key: keyof LoyaltyData, value: number | string) =>
    updateField('loyalty', { ...l, [key]: value });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Loyalty Program</h2>
      <div>
        <label className={labelCls}>Points per Rand spent</label>
        <input
          className={inputCls}
          type="number"
          min={0}
          step={0.1}
          value={l.points_per_rand}
          onChange={(e) => update('points_per_rand', parseFloat(e.target.value) || 0)}
        />
        <p className="text-xs text-gray-400 mt-1">
          Example: 1 means the customer earns 1 point for every R1 spent.
        </p>
      </div>
      <div>
        <label className={labelCls}>Visit milestone (visits until reward)</label>
        <input
          className={inputCls}
          type="number"
          min={1}
          value={l.visit_milestone}
          onChange={(e) => update('visit_milestone', parseInt(e.target.value, 10) || 5)}
        />
        <p className="text-xs text-gray-400 mt-1">Default: 5 visits</p>
      </div>
      <div>
        <label className={labelCls}>Reward description</label>
        <input
          className={inputCls}
          placeholder="e.g. Free premium wash"
          value={l.reward_description}
          onChange={(e) => update('reward_description', e.target.value)}
        />
      </div>
    </div>
  );
}

function StepServices({ data, updateField }: StepProps) {
  const services = data.services;

  const updateService = (index: number, key: keyof ServiceItem, value: string | number) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [key]: value };
    updateField('services', updated);
  };

  const addService = () => {
    if (services.length < 3) {
      updateField('services', [...services, { name: '', price_cents: 0 }]);
    }
  };

  const removeService = (index: number) => {
    updateField(
      'services',
      services.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Add Your First Services</h2>
      <p className="text-sm text-gray-500">Add 1–3 services or products. You can add more later.</p>
      {services.map((svc, i) => (
        <div key={i} className="flex items-end gap-3">
          <div className="flex-1">
            <label className={labelCls}>Service name</label>
            <input
              className={inputCls}
              placeholder="e.g. Basic Wash"
              value={svc.name}
              onChange={(e) => updateService(i, 'name', e.target.value)}
            />
          </div>
          <div className="w-32">
            <label className={labelCls}>Price (R)</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              step={1}
              placeholder="50"
              value={svc.price_cents ? svc.price_cents / 100 : ''}
              onChange={(e) =>
                updateService(i, 'price_cents', Math.round(parseFloat(e.target.value || '0') * 100))
              }
            />
          </div>
          {services.length > 1 && (
            <button
              type="button"
              onClick={() => removeService(i)}
              className="p-2 text-red-400 hover:text-red-600 transition-colors"
              aria-label="Remove service"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {services.length < 3 && (
        <button
          type="button"
          onClick={addService}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Add another service
        </button>
      )}
    </div>
  );
}

function StepTeam({ data, updateField }: StepProps) {
  const invites = data.team_invites;

  const updateEmail = (index: number, email: string) => {
    const updated = [...invites];
    updated[index] = { email };
    updateField('team_invites', updated);
  };

  const addInvite = () => {
    updateField('team_invites', [...invites, { email: '' }]);
  };

  const removeInvite = (index: number) => {
    updateField(
      'team_invites',
      invites.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Invite Your Team</h2>
      <p className="text-sm text-gray-500">
        Add team member emails. They&apos;ll receive invitations after setup.
      </p>
      {invites.map((inv, i) => (
        <div key={i} className="flex items-center gap-3">
          <input
            className={`${inputCls} flex-1`}
            type="email"
            placeholder="staff@mybusiness.co.za"
            value={inv.email}
            onChange={(e) => updateEmail(i, e.target.value)}
          />
          {invites.length > 1 && (
            <button
              type="button"
              onClick={() => removeInvite(i)}
              className="p-2 text-red-400 hover:text-red-600 transition-colors"
              aria-label="Remove invite"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addInvite}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Add another team member
      </button>
    </div>
  );
}

export default OnboardingWizard;
