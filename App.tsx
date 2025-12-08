import React, { useState, useEffect } from 'react';
import { Landing } from './views/Landing';
import { Camera } from './views/Camera';
import { Viewer } from './views/Viewer';
import { AppMode } from './types';
import { isConfigured } from './firebaseConfig';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.LANDING);
  const [roomId, setRoomId] = useState<string>('');
  const [configured, setConfigured] = useState<boolean>(true);

  useEffect(() => {
    setConfigured(isConfigured);
  }, []);

  const handleJoin = (mode: AppMode, id: string) => {
    setRoomId(id);
    setCurrentMode(mode);
  };

  const handleBack = () => {
    setRoomId('');
    setCurrentMode(AppMode.LANDING);
  };

  // Firebase Ayarları Yapılmamışsa Uyarı Göster
  if (!configured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-red-950 text-white text-center">
        <h1 className="text-3xl font-bold mb-4">Kurulum Gerekli</h1>
        <p className="mb-6 text-gray-300">
          Uygulamanın çalışması için <code>firebaseConfig.ts</code> dosyasındaki API anahtarlarını güncellemeniz gerekmektedir.
        </p>
        <div className="bg-black/50 p-4 rounded-lg text-left text-xs font-mono overflow-auto max-w-full">
          <p>1. Firebase Console'a gidin.</p>
          <p>2. Bir proje oluşturun ve Web App ekleyin.</p>
          <p>3. Size verilen config objesini kopyalayın.</p>
          <p>4. firebaseConfig.ts dosyasına yapıştırın.</p>
        </div>
      </div>
    );
  }

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