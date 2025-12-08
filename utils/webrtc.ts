export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Production ortamında buraya TURN sunucuları eklenmelidir.
  ],
  iceCandidatePoolSize: 10,
};

// Video kalitesi için constraint ayarları
export const mediaConstraints: MediaStreamConstraints = {
  audio: true,
  video: {
    width: { ideal: 1920 }, // 1080p hedefler
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
    facingMode: 'environment', // Arka kamera varsayılan
  },
};

export const offerOptions: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};