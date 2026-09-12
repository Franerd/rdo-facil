const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const API = 'https://photospicker.googleapis.com/v1';
const GOOGLE_CLIENT_ID = '352146291111-si26nhlqgp85ir18len279darrrt2d24.apps.googleusercontent.com';

type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback?: (error: unknown) => void }) => TokenClient } } };
type PickingSession = { id: string; pickerUri: string; mediaItemsSet?: boolean; pollingConfig?: { pollInterval?: string; timeoutIn?: string } };
type PickedMediaItem = { id: string; type: string; createTime?: string; mediaFile?: { baseUrl?: string; mimeType?: string; filename?: string } };

declare global { interface Window { google?: GoogleIdentity } }

function loadGoogleIdentity() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts.oauth2) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o acesso do Google.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o acesso do Google.'));
    document.head.appendChild(script);
  });
}

function accessToken(clientId: string) {
  return new Promise<string>(async (resolve, reject) => {
    try {
      await loadGoogleIdentity();
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: response => response.access_token ? resolve(response.access_token) : reject(new Error(response.error_description || response.error || 'Acesso ao Google Fotos não autorizado.')),
        error_callback: reject,
      });
      client.requestAccessToken({ prompt: '' });
    } catch (error) { reject(error); }
  });
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch { /* resposta sem JSON */ }
    throw new Error(detail || `O Google Fotos respondeu com erro ${response.status}.`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

const seconds = (value?: string, fallback = 3) => {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function waitForSelection(session: PickingSession, token: string, onStatus: (message: string) => void) {
  const started = Date.now();
  let current = session;
  while (!current.mediaItemsSet) {
    const timeout = seconds(current.pollingConfig?.timeoutIn, 600);
    if (timeout === 0 || Date.now() - started > Math.max(timeout, 60) * 1000) throw new Error('A seleção do Google Fotos expirou. Tente novamente.');
    onStatus('Escolha as fotos na janela do Google Fotos e toque em Concluir.');
    await new Promise(resolve => setTimeout(resolve, Math.max(seconds(current.pollingConfig?.pollInterval), 1) * 1000));
    current = await api<PickingSession>(`/sessions/${encodeURIComponent(session.id)}`, token);
  }
}

async function selectedItems(sessionId: string, token: string) {
  const items: PickedMediaItem[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ sessionId, pageSize: '100' });
    if (pageToken) query.set('pageToken', pageToken);
    const page = await api<{ mediaItems?: PickedMediaItem[]; nextPageToken?: string }>(`/mediaItems?${query}`, token);
    items.push(...(page.mediaItems || []));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return items;
}

export async function importFromGooglePhotos(onStatus: (message: string) => void) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('A integração com o Google Fotos ainda não foi configurada.');
  onStatus('Conectando ao Google Fotos…');
  const token = await accessToken(clientId);
  const session = await api<PickingSession>('/sessions', token, { method: 'POST', body: JSON.stringify({ pickingConfig: { maxItemCount: '100' } }) });
  const picker = window.open(`${session.pickerUri}/autoclose`, 'rdo-google-photos');
  if (!picker) {
    await api(`/sessions/${encodeURIComponent(session.id)}`, token, { method: 'DELETE' }).catch(() => {});
    throw new Error('Permita pop-ups para abrir o seletor do Google Fotos.');
  }
  try {
    await waitForSelection(session, token, onStatus);
    onStatus('Importando as fotos escolhidas…');
    const items = await selectedItems(session.id, token);
    const files: File[] = [];
    for (const item of items) {
      if (item.type !== 'PHOTO' || !item.mediaFile?.baseUrl) continue;
      const response = await fetch(`${item.mediaFile.baseUrl}=d`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Não foi possível baixar ${item.mediaFile.filename || 'uma das fotos'}.`);
      const blob = await response.blob();
      files.push(new File([blob], item.mediaFile.filename || `google-fotos-${item.id}.jpg`, { type: item.mediaFile.mimeType || blob.type || 'image/jpeg', lastModified: item.createTime ? new Date(item.createTime).getTime() : Date.now() }));
    }
    if (!files.length) throw new Error('Nenhuma foto foi selecionada. Vídeos ainda não são importados.');
    return files;
  } finally {
    await api(`/sessions/${encodeURIComponent(session.id)}`, token, { method: 'DELETE' }).catch(() => {});
  }
}
