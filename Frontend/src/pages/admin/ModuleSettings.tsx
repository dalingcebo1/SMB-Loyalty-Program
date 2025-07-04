// src/pages/admin/ModuleSettings.tsx
import React, { useState, useEffect } from 'react';
import { ModuleFlags, getModuleFlags, setModuleFlags } from '../../config/modules';
import { useAuth } from '../../auth/AuthProvider';
import { Navigate } from 'react-router-dom';

const ModuleSettings: React.FC = () => {
  const { user, loading } = useAuth();
  const [flags, setFlagsState] = useState<ModuleFlags>(getModuleFlags());

  useEffect(() => {
    setFlagsState(getModuleFlags());
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const handleChange = (key: keyof ModuleFlags) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...flags, [key]: e.target.checked };
    setFlagsState(updated);
    setModuleFlags({ [key]: e.target.checked });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Module Settings</h1>
      <div className="space-y-3">
        {(
          Object.keys(flags) as Array<keyof ModuleFlags>
        ).map((key) => (
          <label key={key} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={flags[key]}
              onChange={handleChange(key)}
              className="h-4 w-4"
            />
            <span className="capitalize">{key.replace('enable', '')}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default ModuleSettings;
