'use client';

import { useState } from 'react';

export default function TelegramConnectButton() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    setSuccess(false);

    const res = await fetch('/api/settings/telegram-link', { method: 'POST' });
    const { deepLink } = await res.json() as { deepLink: string };

    window.open(deepLink, '_blank');
    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="bg-gray-900 rounded-2xl p-6 mt-4">
      <h2 className="text-lg font-semibold mb-1">Telegram</h2>
      <p className="text-gray-400 text-sm mb-4">
        Connect your Telegram account to receive wallet alerts.
      </p>

      <button
        onClick={handleConnect}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? 'Generating link…' : 'Connect Telegram'}
      </button>

      {success && (
        <p className="text-green-400 text-sm mt-3">
          ✅ Link opened — complete the connection in Telegram.
        </p>
      )}
    </div>
  );
}
