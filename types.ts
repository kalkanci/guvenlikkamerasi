export interface IceCandidateData {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface WebRTCSignalingData {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface RemoteControls {
  torch: boolean;
  cameraFacing: 'user' | 'environment';
}

export interface DeviceStatus {
  batteryLevel: number | null;
  isCharging: boolean;
  lastOnline: number;
}

export enum AppMode {
  LANDING = 'LANDING',
  CAMERA = 'CAMERA',
  VIEWER = 'VIEWER',
}