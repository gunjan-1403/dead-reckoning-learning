import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SavedMotionCsv = {
  filename: string;
  uri: string;
  rowCount: number;
};

/** Writes the six-channel recording and opens the share sheet so it can leave the phone. */
export async function saveMotionCsv(csv: string, rowCount: number): Promise<SavedMotionCsv> {
  const filename = `imu-${Date.now()}.csv`;
  const file = new File(Paths.document, filename);
  await file.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Save IMU CSV for the model',
      UTI: 'public.comma-separated-values-text',
    });
  }

  return { filename, uri: file.uri, rowCount };
}
