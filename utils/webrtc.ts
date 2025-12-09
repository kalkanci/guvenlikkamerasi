export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// iPhone 6 Fix:
// Çözünürlük dayatmasını kaldırdık. 
// "width/height" belirtmek eski Safari'de getUserMedia'nın fail etmesine veya siyah ekran vermesine yol açabilir.
// Sadece video: true diyerek cihazın nativ çözünürlüğünü alıyoruz.
export const mediaConstraints: MediaStreamConstraints = {
  audio: true,
  video: {
    facingMode: 'environment', // Arka kamera
    // width/height constraints kaldırıldı -> Native stream
  },
};

export const offerOptions: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

// iPhone 6 (iOS 12) SADECE H.264 destekler.
// SDP içindeki codec sıralamasını değiştirip H.264'ü en başa alan fonksiyon.
export const forceH264 = (sdp: string): string => {
  const sdpLines = sdp.split('\r\n');
  const mLineIndex = sdpLines.findIndex(line => line.startsWith('m=video'));
  if (mLineIndex === -1) return sdp;

  // H264 payload tiplerini bul (Genelde 100, 102, 106 vs değişebilir)
  const h264Payloads: string[] = [];
  const rtpMapLines = sdpLines.filter(line => line.startsWith('a=rtpmap:'));
  
  rtpMapLines.forEach(line => {
    if (line.toUpperCase().includes('H264/90000')) {
      const payload = line.split(':')[1].split(' ')[0];
      h264Payloads.push(payload);
    }
  });

  if (h264Payloads.length === 0) return sdp;

  // m=video satırını yeniden düzenle
  const mLine = sdpLines[mLineIndex];
  const elements = mLine.split(' ');
  const header = elements.slice(0, 3); // m=video <port> <proto>
  const payloads = elements.slice(3);
  
  // H264 olmayanları ayır
  const nonH264 = payloads.filter(p => !h264Payloads.includes(p));
  
  // H264'ü en başa koy
  const newMLine = [...header, ...h264Payloads, ...nonH264].join(' ');
  
  sdpLines[mLineIndex] = newMLine;
  return sdpLines.join('\r\n');
};