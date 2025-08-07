import React, { useEffect, useState } from 'react';
import api from '../api/api';

const StatusBanner: React.FC = () => {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    api.get('/openapi.json')
      .then(res => {
        const info = res.data.info;
        if (info && info.version) {
          setVersion(info.version as string);
        }
      })
      .catch(() => {});
  }, []);

  if (!version) return null;

  return (
    <div className="bg-yellow-200 text-yellow-800 text-sm p-2 text-center">
      API Version: {version}
    </div>
  );
};

export default StatusBanner;
