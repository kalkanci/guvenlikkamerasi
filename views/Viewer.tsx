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
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  
  const [status, setStatus] = useState<string>('Kameraya Bağlanıyor...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [nightMode, setNightMode] = useState<boolean>(false);
  const [torchState, setTorchState] = useState<boolean>(false);
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState<boolean>(false);

  useEffect(() => {
    let pc: RTCPeerConnection | null = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;
    const controlsRef = ref(db, `rooms/${roomId}/controls`);

    const startViewer = async () => {
      if (!pc) return;

      // iOS Safari için Transceiver ekle (Video alacağını garanti et)
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'sendrecv' });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
            console.log("Stream alındı:", event.streams[0].id);
            videoRef.current.srcObject = event.streams[0];
            
            // iOS için zorla oynatma denemesi
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log("Otomatik oynatma başarılı");
                }).catch(error => {
                    console.log("Otomatik oynatma engellendi, kullanıcı etkileşimi lazım", error);
                    setShowPlayOverlay(true);
                });
            }

            setStatus('');
            setIsConnected(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          push(ref(db, `rooms/${roomId}/iceCandidates/callee`), event.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
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

      // Offer Handling
      const offerRef = ref(db, `rooms/${roomId}/offer`);
      onValue(offerRef, async (snapshot) => {
        const data = snapshot.val();
        if (pc && pc.signalingState === 'stable' && !pc.currentRemoteDescription && data) {
          try {
            console.log("Offer alındı, işleniyor...");
            const offer = new RTCSessionDescription({ type: 'offer', sdp: data.sdp });
            await pc.setRemoteDescription(offer);
            
            while (iceCandidateQueue.current.length > 0) {
              const candidate = iceCandidateQueue.current.shift();
              if (candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }

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
           setStatus('Kamera Çevrimdışı (Veri Yok)');
           setIsConnected(false);
        }
      });

      // Candidate Handling
      const callerCandidatesRef = ref(db, `rooms/${roomId}/iceCandidates/caller`);
      onValue(callerCandidatesRef, (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          const candidateData = childSnapshot.val();
          if (pc) {
             if (pc.remoteDescription && pc.remoteDescription.type) {
                pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.error(e));
             } else {
                iceCandidateQueue.current.push(candidateData);
             }
          }
        });
      });
    };

    startViewer();

    const statusRef = ref(db, `rooms/${roomId}/status`);
    const statusUnsub = onValue(statusRef, (snapshot) => {
        const val = snapshot.val() as DeviceStatus;
        if(val) setDeviceStatus(val);
    });

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

  // --- ACTIONS ---
  const forcePlayVideo = () => {
      if (videoRef.current) {
          videoRef.current.play();
          setShowPlayOverlay(false);
      }
  };

  const startTalking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localAudioStreamRef.current = stream;
      stream.getTracks().forEach(track => {
        if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
           const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'audio');
           if (sender) {
               sender.replaceTrack(track);
           } else {
               peerConnectionRef.current.addTrack(track, stream);
           }
        }
      });
      setIsTalking(true);
    } catch (err) {
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

  const getBatteryIcon = (level: number | null, charging: boolean) => {
      if (level === null) return "🔋";
      if (charging) return "⚡";
      if (level > 20) return "🔋";
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
      <div className="relative flex-1 overflow-hidden bg-gray-900">
        {!isConnected && !status && (
             <div className="absolute inset-0 flex items-center justify-center z-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
             </div>
        )}

        {!isConnected && status && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-md p-6">
            <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
               </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{status}</h3>
            <Button variant="secondary" onClick={onBack}>ANA MENÜYE DÖN</Button>
          </div>
        )}

        {/* iOS Safari Otomatik Oynatma Engeli için Overlay */}
        {showPlayOverlay && (
            <div 
                className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center cursor-pointer"
                onClick={forcePlayVideo}
            >
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(37,99,235,0.6)] animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                </div>
                <p className="text-white font-bold text-lg">GÖRÜNTÜYÜ BAŞLAT</p>
                <p className="text-gray-400 text-xs mt-2">iOS Güvenlik Kısıtlaması</p>
            </div>
        )}

        <video
          ref={videoRef}
          autoPlay playsInline
          className={`w-full h-full object-cover transition-all duration-500 ${nightMode ? 'brightness-150 contrast-125 grayscale' : ''}`}
        />

        {isConnected && (
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
             <div className="flex items-center space-x-2 bg-red-600/20 border border-red-500/30 px-3 py-1.5 rounded-full backdrop-blur-md">
               <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_red]" />
               <span className="text-[10px] font-bold text-white tracking-widest">CANLI</span>
             </div>
             {deviceStatus && (
               <div className="flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                 <span className={`font-mono text-xs font-bold ${getBatteryColor(deviceStatus.batteryLevel)}`}>
                   {deviceStatus.batteryLevel !== null ? `%${deviceStatus.batteryLevel}` : '--'}
                 </span>
                 <span className="text-lg leading-none">{getBatteryIcon(deviceStatus.batteryLevel, deviceStatus.isCharging)}</span>
               </div>
             )}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border-t border-gray-800 p-6 pb-8 safe-area-pb z-30">
        <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto mb-6">
          <button onClick={toggleTorch} disabled={!isConnected} className={`flex flex-col items-center justify-center space-y-1 p-3 rounded-xl transition-colors disabled:opacity-30 ${torchState ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-400'}`}>
            <span className="text-xl">⚡</span><span className="text-[10px] font-bold">FLAŞ</span>
          </button>
          <button onClick={() => setNightMode(!nightMode)} disabled={!isConnected} className={`flex flex-col items-center justify-center space-y-1 p-3 rounded-xl transition-colors disabled:opacity-30 ${nightMode ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
            <span className="text-xl">☾</span><span className="text-[10px] font-bold">GECE</span>
          </button>
          <button onClick={toggleMute} disabled={!isConnected} className={`flex flex-col items-center justify-center space-y-1 p-3 rounded-xl transition-colors disabled:opacity-30 ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
            <span className="text-xl">{isMuted ? '🔇' : '🔊'}</span><span className="text-[10px] font-bold">SES</span>
          </button>
          <button onClick={onBack} className="flex flex-col items-center justify-center space-y-1 p-3 rounded-xl bg-gray-800 text-red-400 hover:bg-red-900/20">
            <span className="text-xl">✖</span><span className="text-[10px] font-bold">ÇIKIŞ</span>
          </button>
        </div>

        <button
          disabled={!isConnected}
          onPointerDown={startTalking}
          onPointerUp={stopTalking}
          onPointerLeave={stopTalking}
          className={`w-full py-5 rounded-2xl font-black text-lg tracking-wide transition-all duration-200 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${isTalking ? 'bg-blue-500 scale-95 shadow-blue-900/50 text-white' : 'bg-gray-800 text-gray-300 shadow-black/50'}`}
        >
          {isTalking ? 'SES GÖNDERİLİYOR...' : 'KONUŞMAK İÇİN BASILI TUT'}
        </button>
      </div>
    </div>
  );
};