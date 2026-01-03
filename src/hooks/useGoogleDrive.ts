
import { useState, useEffect } from 'react';

// --- CONFIG ---
const CLIENT_ID = '874011854758-vmjga0phkbprlb7kla024t6uc1q6r869.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBdVkRhIvDxiMJU6r47hg3Plfmhi5hUz6A';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

declare global {
    interface Window {
        google: any;
        gapi: any;
    }
}

export function useGoogleDrive() {
    const [tokenClient, setTokenClient] = useState<any>(null);
    const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('gdrive_token'));
    const [isGapiLoaded, setIsGapiLoaded] = useState(false);
    const [isGisLoaded, setIsGisLoaded] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [debugStatus, setDebugStatus] = useState<string>('Initializing...');

    // 1. Initial Load of Libraries
    useEffect(() => {
        // Wait for scripts to load
        const checkScripts = setInterval(() => {
            setDebugStatus(`Checking... GAPI:${window.gapi ? 'OK' : 'No'} GIS:${window.google ? 'OK' : 'No'}`);

            // Check GAPI
            if (window.gapi && !isGapiLoaded) {
                window.gapi.load('client', async () => {
                    try {
                        await window.gapi.client.init({
                            apiKey: API_KEY,
                            discoveryDocs: [DISCOVERY_DOC],
                        });
                        setIsGapiLoaded(true);
                    } catch (e: any) {
                        console.error("GAPI Init Error", e);
                        setError("GAPI Init Failed: " + (e?.message || JSON.stringify(e)));
                    }
                });
            }

            // Check GIS (Google Identity Services)
            if (window.google && !tokenClient) {
                try {
                    const client = window.google.accounts.oauth2.initTokenClient({
                        client_id: CLIENT_ID,
                        scope: SCOPES,
                        callback: (resp: any) => {
                            if (resp.error) {
                                throw resp;
                            }
                            const token = resp.access_token;
                            setAccessToken(token);
                            localStorage.setItem('gdrive_token', token);
                        },
                    });
                    setTokenClient(client);
                    setIsGisLoaded(true);
                } catch (e: any) {
                    console.error("GIS Init Error", e);
                    setError("GIS Init Failed: " + (e?.message || JSON.stringify(e)));
                }
            }

            // Stop checking if both are loaded
            if (window.gapi && window.google && isGapiLoaded && isGisLoaded) {
                setDebugStatus('Ready');
                // clearInterval(checkScripts); // Optional: keep running to catch unloads? No, clear it.
            }
        }, 500);

        return () => clearInterval(checkScripts);
    }, [isGapiLoaded, isGisLoaded, tokenClient]);

    // 2. Login Flow
    const connectToDrive = () => {
        if (!tokenClient) return;
        tokenClient.requestAccessToken({ prompt: 'consent' });
    };

    const disconnectFromDrive = () => {
        const token = localStorage.getItem('gdrive_token');
        if (token && window.google) {
            window.google.accounts.oauth2.revoke(token, () => {
                console.log('Token revoked');
            });
        }
        localStorage.removeItem('gdrive_token');
        setAccessToken(null);
    };

    // 3. Drive Operations
    const uploadFile = async (content: string, filename: string) => {
        if (!window.gapi?.client?.drive) throw new Error("Drive API not loaded");

        const file = new Blob([content], { type: 'text/csv' });
        const metadata = {
            name: filename,
            mimeType: 'text/csv',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: form,
        }).then(res => res.json());
    };

    const listFiles = async () => {
        if (!window.gapi?.client?.drive) throw new Error("Drive API not loaded");
        const res = await window.gapi.client.drive.files.list({
            pageSize: 10,
            fields: 'files(id, name)',
            q: "mimeType = 'text/csv' and trashed = false",
        });
        return res.result.files;
    };

    const downloadFile = async (fileId: string): Promise<string> => {
        if (!window.gapi?.client?.drive) throw new Error("Drive API not loaded");
        const res = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        return res.body;
    };

    return {
        isReady: isGapiLoaded && isGisLoaded,
        isAuthenticated: !!accessToken,
        connectToDrive,
        disconnectFromDrive,
        uploadFile,
        listFiles,
        downloadFile,
        error,
        debugStatus
    };
}
