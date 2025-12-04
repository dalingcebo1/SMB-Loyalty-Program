import React, { useState, useContext } from 'react';
import { TenantConfigContext } from '../../config/TenantConfigProvider';
import api from '../../api/api';
import { useQueryClient } from '@tanstack/react-query';

const LoyaltyProgramSettings: React.FC = () => {
  const context = useContext(TenantConfigContext);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Local state for the form, initialized from context
  // Note: context might be undefined initially, so we handle that safely
  const [selectedType, setSelectedType] = useState<string>('points');

  // Update local state when context loads
  React.useEffect(() => {
    if (context?.loyaltyType) {
      setSelectedType(context.loyaltyType);
    }
  }, [context?.loyaltyType]);

  if (!context) return null;
  const { tenantId, loyaltyType, refresh } = context;

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.patch(`/tenants/${tenantId}`, {
        loyalty_type: selectedType
      });
      setMessage({ type: 'success', text: 'Loyalty program settings updated successfully.' });
      refresh(); // Refresh context to update global state
      // Also invalidate tenant-meta query to be sure
      queryClient.invalidateQueries({ queryKey: ['tenant-meta'] });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Loyalty Program Configuration</h1>
        <p className="text-gray-600 mt-2">
          Choose the core loyalty mechanism for your business. This setting determines how customers earn and redeem rewards.
        </p>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Points Based Option */}
        <div 
          className={`border rounded-lg p-6 cursor-pointer transition-all ${selectedType === 'points' ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          onClick={() => setSelectedType('points')}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Points Based (Tiered)</h3>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedType === 'points' ? 'border-blue-500' : 'border-gray-300'}`}>
              {selectedType === 'points' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Customers earn points for every purchase (e.g., 10 points per $1). Points can be redeemed for various rewards.
            Best for businesses with variable transaction amounts.
          </p>
          <ul className="text-sm text-gray-500 list-disc list-inside space-y-1">
            <li>Flexible earning rates</li>
            <li>Multiple reward tiers</li>
            <li>Encourages higher spend</li>
          </ul>
        </div>

        {/* Stamps Based Option */}
        <div 
          className={`border rounded-lg p-6 cursor-pointer transition-all ${selectedType === 'stamps' ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          onClick={() => setSelectedType('stamps')}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Stamps Based (Milestone)</h3>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedType === 'stamps' ? 'border-blue-500' : 'border-gray-300'}`}>
              {selectedType === 'stamps' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Customers earn a stamp for each visit or specific item purchased. Collect X stamps to get a free reward.
            Best for businesses with repeat, fixed-price services (e.g., coffee, car wash).
          </p>
          <ul className="text-sm text-gray-500 list-disc list-inside space-y-1">
            <li>Simple and easy to understand</li>
            <li>Visual progress tracking</li>
            <li>Encourages repeat visits</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || selectedType === loyaltyType}
          className={`px-6 py-2 rounded-md text-white font-medium transition-colors ${
            saving || selectedType === loyaltyType
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default LoyaltyProgramSettings;
