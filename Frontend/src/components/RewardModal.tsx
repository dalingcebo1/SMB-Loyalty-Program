import React from "react";
import QRCode from "react-qr-code";

interface RewardModalProps {
  isOpen: boolean;
  reward: string;
  qr?: string;
  pin: string;
  onClose: () => void;
}

const RewardModal: React.FC<RewardModalProps> = ({isOpen, reward, qr, pin, onClose}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full flex flex-col items-center relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <div className="font-semibold mb-2 text-center text-lg">{reward}</div>
        {qr && (
          <div className="w-56 h-56 mb-4 flex items-center justify-center">
            <QRCode value={qr} size={220} />
          </div>
        )}
        <div className="mt-2 text-base break-all">
          PIN: <span className="font-mono">{pin}</span>
        </div>
        <div className="text-gray-500 text-base mt-2 text-center">
          Show this code to staff to redeem your reward.
        </div>
        <button
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded font-medium text-base hover:bg-blue-700 min-w-[120px]"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default RewardModal;
