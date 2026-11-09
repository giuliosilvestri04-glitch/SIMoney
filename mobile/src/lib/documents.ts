import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getBaseUrl } from '@/api/config';
import { getAccessToken } from '@/api/session';
import type { DocumentSummary } from '@/api/types';

/**
 * Apertura dei documenti PDF.
 *
 * L'endpoint del backend è protetto: non basta aprire l'URL nel browser, serve
 * il token. Il flusso è quindi:
 *   1. scarico autenticato del file nella cache dell'app;
 *   2. apertura nel visualizzatore PDF nativo (o condivisione/salvataggio).
 *
 * È il comportamento standard delle app bancarie: il documento resta dentro la
 * sandbox dell'app finché l'utente non sceglie di salvarlo altrove.
 */

function safeFileName(document: DocumentSummary): string {
  const base = document.fileName?.trim() || `${document.id}.pdf`;
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function downloadDocument(document: DocumentSummary): Promise<File> {
  const token = getAccessToken();
  const url = `${getBaseUrl()}${document.downloadPath}`;

  const folder = new Directory(Paths.cache, 'documenti');
  try {
    if (!folder.exists) folder.create({ intermediates: true });
  } catch {
    // La cartella potrebbe già esistere: si prosegue.
  }

  const destination = new File(folder, safeFileName(document));

  return File.downloadFileAsync(url, destination, {
    idempotent: true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function useDocumentViewer() {
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = useCallback(async (document: DocumentSummary) => {
    setBusyId(document.id);
    try {
      const file = await downloadDocument(document);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Anteprima non disponibile',
          'Questo dispositivo non consente di aprire il documento dall\'app.',
        );
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: document.mimeType || 'application/pdf',
        // Su iOS indica il tipo di contenuto al foglio di condivisione.
        UTI: 'com.adobe.pdf',
        dialogTitle: document.title,
      });
    } catch (error) {
      const message =
        error instanceof Error && /network|fetch|abort/i.test(error.message)
          ? 'Impossibile scaricare il documento. Verifica la connessione al server del prototipo.'
          : 'Non è stato possibile aprire il documento. Riprova.';
      Alert.alert('Documento non disponibile', message);
    } finally {
      setBusyId(null);
    }
  }, []);

  return {
    open,
    busyId,
    isBusy: (id: string) => busyId === id,
    /** Su Android il foglio di condivisione include il salvataggio su file. */
    saveLabel: Platform.OS === 'ios' ? 'Condividi o salva' : 'Apri o salva',
  };
}
