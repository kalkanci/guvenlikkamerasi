export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Production ortamında buraya TURN sunucuları eklenmelidir.
  ],
  iceCandidatePoolSize: 10,
};

// Video kalitesi için constraint ayarları
// iPhone 6 ve eski cihazlar için 1080p çok ağırdır ve siyah ekrana sebep olur.
// Çözünürlüğü 640x480 (VGA) olarak ayarlıyoruz.
export const mediaConstraints: MediaStreamConstraints = {
  audio: true,
  video: {
    width: { ideal: 640 }, 
    height: { ideal: 480 },
    frameRate: { ideal: 15, max: 24 }, // Kare hızını da düşürdük
    facingMode: 'environment', // Arka kamera varsayılan
  },
};

export const offerOptions: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};