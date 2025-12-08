import React, { useState } from 'react';
import { Landing } from './views/Landing';
import { Camera } from './views/Camera';
import { Viewer } from './views/Viewer';
import { AppMode } from './types';

// Basit Router Implementasyonu
const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.LANDING);
  const [roomId, setRoomId] = useState<string>('');

  const handleJoin = (mode: AppMode, id: string) => {
    setRoomId(id);
    setCurrentMode(mode);
  };

  const handleBack = () => {
    // Sayfayı yenilemek (reload) yerine State'i sıfırlıyoruz.
    // Bu sayede uygulama çökmez ve daha hızlı geçiş yapar.
    // Component'lerin (Camera/Viewer) useEffect cleanup fonksiyonları
    // WebRTC kaynaklarını temizlemekten sorumludur.
    setRoomId('');
    setCurrentMode(AppMode.LANDING);
  };

  return (
    <div className="w-full h-full">
      {currentMode === AppMode.LANDING && (
        <Landing onJoin={handleJoin} />
      )}
      
      {currentMode === AppMode.CAMERA && (
        <Camera roomId={roomId} onBack={handleBack} />
      )}
      
      {currentMode === AppMode.VIEWER && (
        <Viewer roomId={roomId} onBack={handleBack} />
      )}
    </div>
  );
};

export default App;