export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// iPhone 6 Fix:
// Çözünürlüğü kesin olarak 640x480 (VGA) ve 15 FPS ile sınırlıyoruz.
// Yüksek çözünürlük veya FPS eski cihazlarda işlemciyi boğarak siyah ekrana sebep olur.
export const mediaConstraints: MediaStreamConstraints = {
  audio: true,
  video: {
    facingMode: 'environment',
    width: { ideal: 640, max: 640 },
    height: { ideal: 480, max: 480 },
    frameRate: { ideal: 15, max: 15 }
  },
};

export const offerOptions: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

// iPhone 6 (iOS 12) SADECE H.264 destekler.
export const forceH264 = (sdp: string): string => {
  const sdpLines = sdp.split('\r\n');
  const mLineIndex = sdpLines.findIndex(line => line.startsWith('m=video'));
  if (mLineIndex === -1) return sdp;

  const h264Payloads: string[] = [];
  const rtpMapLines = sdpLines.filter(line => line.startsWith('a=rtpmap:'));
  
  rtpMapLines.forEach(line => {
    if (line.toUpperCase().includes('H264/90000')) {
      const payload = line.split(':')[1].split(' ')[0];
      h264Payloads.push(payload);
    }
  });

  if (h264Payloads.length === 0) return sdp;

  const mLine = sdpLines[mLineIndex];
  const elements = mLine.split(' ');
  const header = elements.slice(0, 3);
  const payloads = elements.slice(3);
  
  const nonH264 = payloads.filter(p => !h264Payloads.includes(p));
  const newMLine = [...header, ...h264Payloads, ...nonH264].join(' ');
  
  sdpLines[mLineIndex] = newMLine;
  return sdpLines.join('\r\n');
};