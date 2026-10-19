import * as Picker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { read, write, remove, sessionScope } from "./api";
import { workId, persistPhoto, workQueue, discardWork } from "./work-storage";
import type { Trip } from "./board";
type Intent = { id: string; scope: string; tripId: string; title: string; kind: "cmr" | "pod"; replaceId?: string };
const KEY = "paperwork-capture-v1";
async function finish(intent: Intent, result: Picker.ImagePickerResult | Picker.ImagePickerErrorResult | null) {
  if (!result) return null;
  if ("code" in result) throw new Error("Camera nu a returnat fotografia. Reîncearcă sau alege din galerie.");
  if (result.canceled) { await remove(KEY); return null; }
  if (await sessionScope() !== intent.scope) throw new Error("Fotografia aparține altui cont. Revino în contul în care ai început.");
  if ((await workQueue.list(intent.scope)).some(e => e.id === intent.id)) { await remove(KEY); return intent.id; }
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri, { maxWidth: 2200, maxHeight: 2200 });
  if (Math.max(asset.width, asset.height) > 2200) context.resize(asset.width >= asset.height ? { width: 2200 } : { height: 2200 });
  const rendered = await context.renderAsync();
  try {
    const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: .8 });
    const file = new File(photo.uri);
    try {
      if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("Fotografia depășește 2 MB. Fotografiază câte o pagină, mai aproape, apoi reîncearcă.");
      const fileName = `${intent.id}.jpg`;
      await persistPhoto(photo.uri, fileName);
      await workQueue.add({ id: intent.id, scope: intent.scope, tripId: intent.tripId, title: intent.title, kind: intent.kind,
        type: "file", fileName, size: file.size, createdAt: new Date().toISOString(), status: "draft", attempts: 0, nextAttempt: 0 });
      if (intent.replaceId) await discardWork(intent.scope, intent.replaceId);
      await remove(KEY);
      return intent.id;
    } finally { try { if (file.exists) file.delete(); } catch { /* Temporary cache only. */ } }
  } finally { rendered.release(); context.release(); }
}
export async function captureDocument(trip: Trip, kind: "cmr" | "pod", source: "camera" | "library", replaceId?: string) {
  if (source === "camera") {
    let permission = await Picker.getCameraPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Picker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Camera nu are acces. Alege din galerie sau activează Camera din Setările telefonului.");
  }
  const intent: Intent = { id: workId(), scope: await sessionScope(), tripId: trip.id, title: trip.title, kind, replaceId };
  await write(KEY, intent);
  const options: Picker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: false, quality: 1, exif: false, base64: false };
  return finish(intent, source === "camera" ? await Picker.launchCameraAsync(options) : await Picker.launchImageLibraryAsync(options));
}
/** Android may recreate the activity while the system camera is open. */
export async function recoverDocument() {
  const intent = await read<Intent>(KEY);
  if (!intent || intent.scope !== await sessionScope()) return;
  await finish(intent, await Picker.getPendingResultAsync());
}
