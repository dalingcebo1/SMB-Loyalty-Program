import React, { useState, useContext, useEffect } from 'react';
import { TenantConfigContext } from '../../config/TenantConfigProvider';
import api from '../../api/api';
import { useQueryClient } from '@tanstack/react-query';

interface LoyaltyConfig {
  points?: {
    earningRate: number; // points per currency unit (e.g. 10 points per )
    redemptionValue: number; // value of 1 point in cents (e.g. 1 cent)
  };
  stamps?: {
    stampsPerReward: number;
    rewardName: string;
  };
  cashback?: {
    percentage: number; // e.g. 5 for 5%
  };
}

const LoyaltyProgramSettings: React.FC = () => {
  const context = useContext(TenantConfigContext);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Local state
  const [selectedType, setSelectedType] = useState<string>('points');
  const [config, setConfig] = useState<LoyaltyConfig>({
    points: { earningRate: 10, redemptionValue: 1 },
    stamps: { stampsPerReward: 10, rewardName: 'Free Coffee' },
    cashback: { percentage: 5 }
  });
  const [fullTenantConfig, setFullTenantConfig] = useState<any>({});

  // Fetch full tenant details to get the config
  useEffect(() => {
    const fetchTenantDetails = async () => {
      if (!context?.tenantId) return;
      try {
        const { data } = await api.get(`/tenants/${context.tenantId}`);
        setFullTenantConfig(data.config || {});
        
        if (data.loyalty_type) {
          setSelectedType(data.loyalty_type);
        }
        
        if (data.config?.loyalty) {
          setConfig(prev => ({
            ...prev,
            ...data.config.loyalty
          }));
        }
      } catch (err) {
        console.error('Failed to fetch tenant details', err);
        setMessage({ type: 'error', text: 'Failed to load current settings.' });
      } finally {
        setLoading(false);
      }
    };

    if (context?.tenantId) {
      fetchTenantDetails();
    }
  }, [context?.tenantId]);

  if (!context) return null;
  const { tenantId, refresh, vertical } = context;

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setMessage(null);
    try {
      const updatedConfig = {
        ...fullTenantConfig,
        loyalty: config
      };

      await api.patch(`/tenants/${tenantId}`, {
        loyalty_type: selectedType,
        config: updatedConfig
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

  const getRecommendation = (type: string) => {
    if (vertical === 'carwash' && type === 'stamps') return true;
    if (vertical === 'dispensary' && type === 'points') return true;
    return false;
  };

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto overflow-x-hidden">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        {/* Points Based Option */}
        <div 
          className={`border rounded-lg p-4 md:p-6 cursor-pointer transition-all relative ${selectedType === 'points' ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          onClick={() => setSelectedType('points')}
        >
          {getRecommendation('points') && (
            <span className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">Recommended</span>
          )}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Points Program</h3>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedType === 'points' ? 'border-blue-500' : 'border-gray-300'}`}>
              {selectedType === 'points' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Customers accrue points based on spend. Points can be redeemed for discounts or rewards.
          </p>
        </div>

        {/* Stamps Based Option */}
        <div 
          className={`border rounded-lg p-4 md:p-6 cursor-pointer transition-all relative ${selectedType === 'stamps' ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          onClick={() => setSelectedType('stamps')}
        >
          {getRecommendation('stamps') && (
            <span className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">Recommended</span>
          )}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Punch Card</h3>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedType === 'stamps' ? 'border-blue-500' : 'border-gray-300'}`}>
              {selectedType === 'stamps' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Digital punch card. Customers earn a stamp per visit or item purchased. Unlock rewards at milestones.
          </p>
        </div>

        {/* Cashback Option */}
        <div 
          className={`border rounded-lg p-4 md:p-6 cursor-pointer transition-all relative ${selectedType === 'cashback' ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          onClick={() => setSelectedType('cashback')}
        >
           {getRecommendation('cashback') && (
            <span className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">Recommended</span>
          )}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Cashback</h3>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedType === 'cashback' ? 'border-blue-500' : 'border-gray-300'}`}>
              {selectedType === 'cashback' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Simple percentage return. Customers earn a percentage of their spend back as store credit.
          </p>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {selectedType === 'points' && 'Points Program Configuration'}
          {selectedType === 'stamps' && 'Punch Card Configuration'}
          {selectedType === 'cashback' && 'Cashback Configuration'}
        </h2>

        {selectedType === 'points' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accrual Ratio (Points per Unit)</label>
              <input
                type="number"
                value={config.points?.earningRate || 10}
                onChange={(e) => setConfig({ ...config, points: { ...config.points!, earningRate: Number(e.target.value) } })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">The number of points a customer accrues for every 1 unit of currency spent (e.g., 10 points per R1).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Redemption Ratio (Cents per Point)</label>
              <input
                type="number"
                value={config.points?.redemptionValue || 1}
                onChange={(e) => setConfig({ ...config, points: { ...config.points!, redemptionValue: Number(e.target.value) } })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">The monetary value of a single point when redeemed (e.g., 1 point = 1 cent).</p>
            </div>
          </div>
        )}

        {selectedType === 'stamps' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stamps per Reward</label>
              <input
                type="number"
                value={config.stamps?.stampsPerReward || 10}
                onChange={(e) => setConfig({ ...config, stamps: { ...config.stamps!, stampsPerReward: Number(e.target.value) } })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Number of stamps required to unlock the reward.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reward Name</label>
              <input
                type="text"
                value={config.stamps?.rewardName || 'Free Item'}
                onChange={(e) => setConfig({ ...config, stamps: { ...config.stamps!, rewardName: e.target.value } })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Description of the reward (e.g., "Free Coffee").</p>
            </div>
          </div>
        )}

        {selectedType === 'cashback' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cashback Percentage (%)</label>
              <input
                type="number"
                value={config.cashback?.percentage || 5}
                onChange={(e) => setConfig({ ...config, cashback: { ...config.cashback!, percentage: Number(e.target.value) } })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Percentage of purchase amount returned as store credit.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2 rounded-md text-white font-medium transition-colors ${
            saving
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
