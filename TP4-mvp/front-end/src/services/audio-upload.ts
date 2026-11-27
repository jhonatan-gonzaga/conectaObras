import {
  AudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

import { api } from "./api";

export type AudioRecordingState = {
  recording: AudioRecorder | null;
  startedAt: number | null;
};

export async function startAudioRecording(
  recording: AudioRecorder,
): Promise<AudioRecordingState> {
  const permission = await requestRecordingPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Permita o acesso ao microfone para enviar audio.");
  }

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  await recording.prepareToRecordAsync();
  recording.record();

  return { recording, startedAt: Date.now() };
}

export async function stopAndUploadAudio(state: AudioRecordingState) {
  if (!state.recording) {
    return null;
  }

  await state.recording.stop();
  const uri = state.recording.uri;

  if (!uri) {
    return null;
  }

  const uploaded = await api.uploadAudio({
    uri,
    name: `audio-${Date.now()}.m4a`,
    type: "audio/m4a",
  });

  return {
    url: uploaded.url,
    durationMs: state.startedAt ? Date.now() - state.startedAt : undefined,
  };
}
