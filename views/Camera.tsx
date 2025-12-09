import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebaseConfig';
import { ref, set, onValue, push, onDisconnect, remove, update } from 'firebase/database';
import { rtcConfig, mediaConstraints, offerOptions, forceH264 } from '../utils/webrtc';
import { Button } from '../components/Button';
import { RemoteControls } from '../types';

interface CameraProps {
  roomId: string;
  onBack: () => void;
}

// iPhone 6 vb. eski cihazlar için Ekranı Açık Tutma Hack'i
const IOS_WAKE_LOCK_VIDEO = "data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAACQm1kYXQAAAKABGB/wAAAAAAAAAAAAIyZMOvwAAAABBgaft5je4AAAAAly1moAAAAAAAMav+AAAAAkW1vb3YAAABsbXZoAAAAAMj4U2PI+FNjAAABAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABudHJhawAAAFx0a2hkAAAAAdI+U2PSPlNjAAAAAQAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAEAAAEAAAAAAQAAAAAgbWRpYQAAACBtZGh1AAAAANI+U2PSPlNjAAABAAABAAAAAAA5AAAAGWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABtaW5mAAAAFHZtaGQAAAAQAAAAAAAAAAAAAAAkZGluZgAAABRkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAEibWJscQAAALRhdmMxAAAAAAAAAAEAAAEAAAAAAAAAAAAAAAEAAAEAAAAAAAEADgAAAAEAAAAAAAYAAQAAAAAAIAAAACAAAAAAAAAAAAAAAAAAAAAAAAEABAExYXZjQwAp/4D/gAAAExBnz/4AAAAMZ0BAAAAAAwABAAAADGltZyIAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAEAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABxzdHN6AAAAAAAAAAAAAAABAAAALQAAABxzdGNvAAAAAAAAAAEAAAAsAAAAAQAA";

export const Camera: React.FC<CameraProps> = ({ roomId, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wakeLockVideoRef = useRef<HTMLVideoElement>(null); 
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [status, setStatus] = useState<string>('Hazırlanıyor...');
  const [activeClient, setActiveClient] = useState<boolean>(false);
  
  // State for camera controls
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [powerSavingMode, setPowerSavingMode] = useState<boolean>(false);

  // --- WAKE LOCK ---
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          // @ts-ignore
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {}
    };
    requestWakeLock();

    if (wakeLockVideoRef.current) {
      wakeLockVideoRef.current.play().catch(() => {});
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        wakeLockVideoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  // --- BATARYA DURUMU ---
  useEffect(() => {
    const updateBatteryStatus = async () => {
      // @ts-ignore 
      if (navigator.getBattery) {
        try {
          // @ts-ignore
          const battery = await navigator.getBattery();
          const reportStatus = () => {
            update(ref(db, `rooms/${roomId}/status`), {
              batteryLevel: Math.round(battery.level * 100),
              isCharging: battery.charging,
              lastOnline: Date.now()
            });
          };
          reportStatus();
          battery.addEventListener('levelchange', reportStatus);
          battery.addEventListener('chargingchange', reportStatus);
          return () => {
            battery.removeEventListener('levelchange', reportStatus);
            battery.removeEventListener('chargingchange', reportStatus);
          };
        } catch (e) { console.log("Battery API Error", e); }
      } else {
        update(ref(db, `rooms/${roomId}/status`), {
          batteryLevel: null,
          isCharging: false,
          lastOnline: Date.now()
        });
      }
    };
    updateBatteryStatus();
    
    const interval = setInterval(() => {
       update(ref(db, `rooms/${roomId}/status`), { lastOnline: Date.now() });
    }, 10000);
    return () => clearInterval(interval);
  }, [roomId]);

  // --- WEBRTC & FIREBASE ---
  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    set(roomRef, null).then(() => {
        startStream();
    });
    
    onDisconnect(roomRef).remove();

    const startStream = async () => {
      try {
        setStatus('Kamera Başlatılıyor...');
        // Constraints güncellendi, width/height kaldırıldı
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        localStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Explicit play çağrısı
          videoRef.current.play().catch(e => console.error("Local play error:", e));
        }

        initializePeerConnection(stream);
      } catch (err) {
        console.error("Kamera hatası:", err);
        setStatus('Kamera Erişimi Yok!');
        alert("Kamera başlatılamadı. Lütfen Safari izinlerini kontrol edin.");
      }
    };

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          try { track.stop(); } catch(e) {}
        });
      }
      if (peerConnectionRef.current) {
        try { peerConnectionRef.current.close(); } catch(e) {}
      }
      remove(roomRef).catch(err => console.error("Oda silinemedi:", err));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // --- KONTROLLER ---
  useEffect(() => {
    const controlsRef = ref(db, `rooms/${roomId}/controls`);
    const unsubscribe = onValue(controlsRef, (snapshot) => {
      const data = snapshot.val() as RemoteControls;
      if (data) {
        if (data.torch !== undefined) setTorchEnabled(data.torch);
        if (data.cameraFacing) setCameraFacing(data.cameraFacing);
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  // --- FLAŞ ---
  useEffect(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    applyTorchToTrack(videoTrack, torchEnabled);
  }, [torchEnabled]);

  // --- KAMERA DEĞİŞTİRME ---
  useEffect(() => {
    const switchCamera = async () => {
      if (!localStreamRef.current) return;
      const currentTrack = localStreamRef.current.getVideoTracks()[0];
      const settings = currentTrack?.getSettings();
      if (settings?.facingMode === cameraFacing) return;

      try {
        if (currentTrack) currentTrack.stop();
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            // width/height kullanmadan sadece facingMode
            facingMode: cameraFacing
          }
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        applyTorchToTrack(newVideoTrack, torchEnabled);

        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        const newMediaStream = new MediaStream([newVideoTrack]);
        if (audioTrack) newMediaStream.addTrack(audioTrack);
        
        localStreamRef.current = newMediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = newMediaStream;
          videoRef.current.play().catch(e => {});
        }

        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }
      } catch (err) {
        console.error("Camera switch error:", err);
      }
    };

    switchCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFacing]);

  const applyTorchToTrack = (track: MediaStreamTrack | undefined, enabled: boolean) => {
    if (!track) return;
    try {
        // @ts-ignore
        const capabilities = track.getCapabilities();
        // @ts-ignore
        if (capabilities.torch) {
          track.applyConstraints({
            // @ts-ignore
            advanced: [{ torch: enabled }]
          }).catch(e => console.log('Torch error', e));
        }
    } catch(e) { console.log("Torch yok"); }
  };

  const initializePeerConnection = async (stream: MediaStream) => {
    setStatus('Bağlantı Bekleniyor...');
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      const remoteAudio = new Audio();
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.autoplay = true;
      remoteAudio.play().catch(e => {});
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        push(ref(db, `rooms/${roomId}/iceCandidates/caller`), event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('YAYINDA');
        setActiveClient(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('Bağlantı Koptu');
        setActiveClient(false);
      } else if (pc.connectionState === 'new' || pc.connectionState === 'connecting') {
        setStatus('Bağlanıyor...');
        setActiveClient(false);
      }
    };

    try {
      const offerDescription = await pc.createOffer(offerOptions);
      
      // H.264 ZORLAMA (iPhone 6 için KRİTİK)
      const sdpWithH264 = forceH264(offerDescription.sdp || "");
      const finalOffer = new RTCSessionDescription({
          type: offerDescription.type,
          sdp: sdpWithH264
      });

      await pc.setLocalDescription(finalOffer);

      await set(ref(db, `rooms/${roomId}/offer`), {
        type: finalOffer.type,
        sdp: finalOffer.sdp,
      });

      onValue(ref(db, `rooms/${roomId}/answer`), (snapshot) => {
        const data = snapshot.val();
        if (pc.signalingState !== "stable" && data && data.answer) {
          const answer = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answer).catch(e => console.error("SetRemoteDesc Error", e));
        }
      });

      onValue(ref(db, `rooms/${roomId}/iceCandidates/callee`), (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          if(pc.remoteDescription) {
             const candidate = new RTCIceCandidate(childSnapshot.val());
             pc.addIceCandidate(candidate).catch(e => console.error("AddIce Error", e));
          }
        });
      });
    } catch(err) {
        console.error("Signaling error", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
      <video 
        ref={wakeLockVideoRef}
        playsInline muted loop autoPlay
        src={IOS_WAKE_LOCK_VIDEO}
        className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none"
      />
      
      {powerSavingMode && (
        <div 
          onClick={() => setPowerSavingMode(false)}
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center cursor-pointer touch-manipulation"
        >
          <div className="opacity-10 text-white text-center select-none animate-pulse">
            <div className="w-4 h-4 rounded-full bg-red-600 mx-auto mb-2" />
            <p className="font-mono text-xs tracking-widest">KAYIT DEVAM EDİYOR</p>
          </div>
          <p className="absolute bottom-10 opacity-5 text-white text-[10px]">Açmak için ekrana dokunun</p>
        </div>
      )}

      {/* DÜZELTME: Opacity varsayılan olarak %100 yapıldı. Sadece güç tasarrufunda kapanır. */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className={`absolute w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${powerSavingMode ? 'opacity-0' : 'opacity-100'}`}
      />

      <div className={`z-10 flex flex-col items-center justify-center space-y-6 w-full max-w-sm px-6 transition-opacity duration-300 ${powerSavingMode ? 'opacity-0' : 'opacity-100'}`}>
        <div className={`relative flex items-center justify-center w-32 h-32 rounded-full border-4 transition-all duration-700 ${
          activeClient ? 'border-red-600 bg-red-900/20 shadow-[0_0_50px_rgba(220,38,38,0.6)]' : 'border-yellow-600 bg-yellow-900/10'
        }`}>
           {activeClient ? (
             <div className="w-14 h-14 bg-red-600 rounded-lg animate-pulse shadow-lg shadow-red-900" />
           ) : (
             <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
           )}
        </div>

        <div className="text-center space-y-2">
            <h2 className={`text-3xl font-black tracking-tighter uppercase transition-colors duration-300 ${activeClient ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>
              {activeClient ? 'CANLI YAYIN' : status}
            </h2>
            {!activeClient && <p className="text-gray-500 text-sm font-mono animate-pulse">İzleyici bekleniyor...</p>}
            <div className="inline-block bg-gray-900 px-6 py-3 rounded-full border border-gray-800 mt-6 shadow-xl">
              <p className="text-xs text-gray-400 font-mono tracking-widest flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                ODA ID: <span className="text-white font-bold text-sm">{roomId}</span>
              </p>
            </div>
        </div>
      </div>

      <div className={`absolute bottom-10 z-20 w-full px-8 max-w-md transition-opacity duration-300 ${powerSavingMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="space-y-3">
          <Button variant="ghost" fullWidth onClick={() => setPowerSavingMode(true)} className="border border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/30 hover:text-green-400">
            GÜÇ TASARRUFU MODU
          </Button>
          <Button variant="secondary" fullWidth onClick={onBack} className="border-gray-800 bg-gray-900 hover:bg-red-900/30 hover:border-red-800 hover:text-red-400 transition-all">
            YAYINI DURDUR
          </Button>
        </div>
      </div>
    </div>
  );
};