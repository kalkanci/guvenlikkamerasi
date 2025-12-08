import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebaseConfig';
import { ref, set, onValue, push, remove } from 'firebase/database';
import { rtcConfig } from '../utils/webrtc';
import { RemoteControls, DeviceStatus } from '../types';
import { Button } from '../components/Button';

interface ViewerProps {
  roomId: string;
  onBack: () => void;
}

export const Viewer: React.FC<ViewerProps> = ({ roomId, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  
  const [status, setStatus] = useState<string>('Kameraya Bağlanıyor...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [nightMode, setNightMode] = useState<boolean>(false);
  const [torchState, setTorchState] = useState<boolean>(false);
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);

  useEffect(() => {
    let pc: RTCPeerConnection | null = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;
    const controlsRef = ref(db, `rooms/${roomId}/controls`);

    const startViewer = async () => {
      if (!pc) return;

      // Track geldiğinde videoya bağla
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setStatus('');
            setIsConnected(true);
        }
      };

      // ICE Candidate gönder
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          push(ref(db, `rooms/${roomId}/iceCandidates/callee`), event.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("Connection State:", pc?.connectionState);
        if(pc?.connectionState === 'connected') {
            setIsConnected(true);
            setStatus('');
        } else if(pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed') {
            setIsConnected(false);
            setStatus('Bağlantı Koptu');
        } else if (pc?.connectionState === 'closed') {
            setIsConnected(false);
        }
      };

      // Offer'ı Firebase'den al
      const offerRef = ref(db, `rooms/${roomId}/offer`);
      onValue(offerRef, async (snapshot) => {
        const data = snapshot.val();
        if (pc && pc.signalingState === 'stable' && !pc.currentRemoteDescription && data) {
          try {
            const offer = new RTCSessionDescription({ type: 'offer', sdp: data.sdp });
            await pc.setRemoteDescription(offer);

            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);

            await set(ref(db, `rooms/${roomId}/answer`), {
              answer: {
                type: answerDescription.type,
                sdp: answerDescription.sdp
              }
            });
          } catch (e) {
            console.error("Signaling Error:", e);
          }
        } else if (!data) {
           // Veri yoksa (Kamera kapalıysa)
           setStatus('Kamera Çevrimdışı');
           setIsConnected(false);
        }
      });

      // Caller ICE Candidate'lerini dinle
      const callerCandidatesRef = ref(db, `rooms/${roomId}/iceCandidates/caller`);
      onValue(callerCandidatesRef, (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          if (pc && pc.remoteDescription) {
             const candidate = new RTCIceCandidate(childSnapshot.val());
             pc.addIceCandidate(candidate).catch(e => console.error(e));
          }
        });
      });
    };

    startViewer();

    // BATARYA VE CİHAZ DURUMUNU DİNLE
    const statusRef = ref(db, `rooms/${roomId}/status`);
    const statusUnsub = onValue(statusRef, (snapshot) => {
        const val = snapshot.val() as DeviceStatus;
        if(val) setDeviceStatus(val);
    });

    // CLEANUP
    return () => {
      statusUnsub();
      if (pc) {
        pc.close();
        peerConnectionRef.current = null;
      }
      remove(controlsRef).catch(() => {});
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [roomId]);

  // Push to Talk Mantığı
  const startTalking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localAudioStreamRef.current = stream;
      stream.getTracks().forEach(track => {
        if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
          peerConnectionRef.current.addTrack(track, stream);
        }
      });
      setIsTalking(true);
    } catch (err) {
      console.error("Mikrofon hatası:", err);
      alert("Mikrofon izni gerekli.");
    }
  };

  const stopTalking = () => {
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localAudioStreamRef.current = null;
    }
    setIsTalking(false);
  };

  const toggleTorch = () => {
    const newState = !torchState;
    setTorchState(newState);
    set(ref(db, `rooms/${roomId}/controls`), {
      torch: newState,
      cameraFacing: 'environment'
    } as RemoteControls);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  // Batarya ikonunu seçen yardımcı fonksiyon
  const getBatteryIcon = (level: number | null, charging: boolean) => {
      if (level === null) return "🔋";
      if (charging) return "⚡";
      if (level > 80) return "🔋";
      if (level > 50) return "🔋"; 
      if (level > 20) return "🪫";
      return "🪫";
  };
  
  const getBatteryColor = (level: number | null) => {
      if (!level) return "text-gray-400";
      if (level < 20) return "text-red-500";
      if (level < 50) return "text-yellow-500";
      return "text-green-500";
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Video Alanı */}
      <div className="relative flex-1 overflow-hidden bg-gray-900">
        
        {/* HATA / YÜKLENİYOR EKRANI */}
        {!isConnected && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-md p-6">
            <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
               </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{status || 'Bağlantı Bekleniyor'}</h3>
            <p className="text-gray-400 text-sm text-center mb-8 max-w-xs">
              Kamera cihazının internet bağlantısını ve uygulamanın açık olduğunu kontrol edin.
            </p>
            <Button variant="secondary" onClick={onBack}>
              ANA MENÜYE DÖN
            </Button>
          </div>
        )}

        {/* Video Player */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover transition-all duration-500 ${
            nightMode ? 'brightness-150 contrast-125 grayscale' : ''
          }`}
        />

        {/* Üst Bilgi Çubuğu (Overlay) */}
        {isConnected && (
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
             {/* Sol: Canlı Göstergesi */}
             <div className="flex items-center space-x-2 bg-red-600/20 border border-red-500/30 px-3 py-1.5 rounded-full backdrop-blur-md">
               <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_red]" />
               <span className="text-[10px] font-bold text-white tracking-widest">CANLI</span>
             </div>

             {/* Sağ: Batarya Durumu */}
             {deviceStatus && (
               <div className="flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                 <span className={`font-mono text-xs font-bold ${getBatteryColor(deviceStatus.batteryLevel)}`}>
                   {deviceStatus.batteryLevel !== null ? `%${deviceStatus.batteryLevel}` : '--'}
                 </span>
                 <span className="text-lg leading-none">
                    {getBatteryIcon(deviceStatus.batteryLevel, deviceStatus.isCharging)}
                 </span>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Kontrol Paneli */}
      <div className="bg-gray-900 border-t border-gray-800 p-6 pb-8 safe-area-pb z-30">
        <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto mb-6">
          {/* Flaş */}
          <button 
            onClick={toggleTorch}
            disabled={!isConnected}
            className={`flex flex-col items-center justify-center space-y-1 p-3 rounded-xl transition-colors disabled:opacity-30 ${torchState ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-400'}`}
          >
            <span className="text-xl">⚡</span>
            <span className="text-[10px] font-bold">FLAŞ</span>
          </button>

          {/* Gece Modu */}
          <button 
            onClick={() => setNightMode(!nightMode)}
            disabled={!isConnected}
            className={`flex flex-col items-center justify-center space-y-1 p-3 rounded-xl transition-colors disabled:opacity-30 ${nightMode ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}
          >
            <span className="text-xl">☾</span>
            <span className="text-[10px] font-bold">GECE</span>
          </button>

          {/* Ses Dinle/Sustur */}
          <button 
            onClick={toggleMute}
            disabled={!isConnected}
            className={`flex flex-col items-center justify-center space-y-1 p-3 rounded-xl transition-colors disabled:opacity-30 ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400'}`}
          >
            <span className="text-xl">{isMuted ? '🔇' : '🔊'}</span>
            <span className="text-[10px] font-bold">SES</span>
          </button>

          {/* Çıkış */}
          <button 
            onClick={onBack}
            className="flex flex-col items-center justify-center space-y-1 p-3 rounded-xl bg-gray-800 text-red-400 hover:bg-red-900/20"
          >
            <span className="text-xl">✖</span>
            <span className="text-[10px] font-bold">ÇIKIŞ</span>
          </button>
        </div>

        {/* Bas Konuş Butonu */}
        <button
          disabled={!isConnected}
          onPointerDown={startTalking}
          onPointerUp={stopTalking}
          onPointerLeave={stopTalking}
          className={`w-full py-5 rounded-2xl font-black text-lg tracking-wide transition-all duration-200 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
            isTalking 
            ? 'bg-blue-500 scale-95 shadow-blue-900/50 text-white' 
            : 'bg-gray-800 text-gray-300 shadow-black/50'
          }`}
        >
          {isTalking ? 'SES GÖNDERİLİYOR...' : 'KONUŞMAK İÇİN BASILI TUT'}
        </button>
      </div>
    </div>
  );
};