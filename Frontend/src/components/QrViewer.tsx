import React from "react";

export const QrViewer: React.FC<{ data: string }> = ({ data }) => (
  <div>
    <img src={data} alt="Scan to validate payment" />
  </div>
);
