import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const Scanner = () => {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qr-reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    });

    scanner.render(
      (decodedText) => {
        fetch('http://localhost:8000/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: decodedText })
        })
        .then(res => res.json())
        .then(data => alert(data.message))
        .catch(err => alert("Redeem failed: " + err));

        scanner.clear(); // Stop scanner after success
      },
      (error) => {
        console.warn("Scan error", error);
      }
    );

    return () => {
      scanner.clear();
    };
  }, []);

  return (
    <div className="flex flex-col items-center mt-10">
      <h1 className="text-2xl mb-4">Scan Customer Reward QR</h1>
      <div id="qr-reader" className="w-full max-w-md"></div>
    </div>
  );
};

export default Scanner;
