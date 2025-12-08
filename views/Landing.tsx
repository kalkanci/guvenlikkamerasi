import React, { useState } from 'react';
import { AppMode } from '../types';
import { Button } from '../components/Button';

interface LandingProps {
  onJoin: (mode: AppMode, roomId: string) => void;
}

export const Landing: React.FC<LandingProps> = ({ onJoin }) => {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  const handleJoin = (mode: AppMode) => {
    if (!roomId.trim()) {
      setError('Lütfen bir Oda Adı girin.');
      return;
    }
    if (roomId.length < 3) {
      setError('Oda adı en az 3 karakter olmalıdır.');
      return;
    }
    onJoin(mode, roomId.trim());
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-oled-black">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            GÜVENLİK
            <br />
            KAMERASI
          </h1>
          <p className="text-gray-500 text-sm">Eski cihazınızı değerlendirin.</p>
        </div>

        <div className="space-y-4 bg-dark-gray p-6 rounded-2xl border border-gray-800">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">ODA ADI (ID)</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setError('');
              }}
              placeholder="Örn: salon-kamera-1"
              className="w-full bg-black border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
            />
          </div>

          {error && <p className="text-red-500 text-xs ml-1">{error}</p>}

          <div className="grid grid-cols-1 gap-4 pt-2">
            <Button 
              variant="primary" 
              onClick={() => handleJoin(AppMode.CAMERA)}
              className="flex flex-col items-center justify-center h-24"
            >
              <span className="text-xl">KAMERA MODU</span>
              <span className="text-xs font-normal opacity-70 mt-1">Bu Cihaz Yayın Yapar</span>
            </Button>

            <Button 
              variant="secondary" 
              onClick={() => handleJoin(AppMode.VIEWER)}
              className="flex flex-col items-center justify-center h-24"
            >
              <span className="text-xl">İZLEYİCİ MODU</span>
              <span className="text-xs font-normal opacity-70 mt-1">Bu Cihaz İzler</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};