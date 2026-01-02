
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

    // 1. Initial Load of Libraries
    useEffect(() => {
        // Wait for scripts to load
        const checkScripts = setInterval(() => {
            if (window.gapi) {
                window.gapi.load('client', async () => {
                    await window.gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    setIsGapiLoaded(true);
                });
                clearInterval(checkScripts);
            }
        }, 500);

        if (window.google) {
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
        }

        return () => clearInterval(checkScripts);
    }, []);

    // 2. Login Flow
    const login = () => {
        if (!tokenClient) return;
        tokenClient.requestAccessToken({ prompt: 'consent' });
    };

    const logout = () => {
        const token = localStorage.getItem('gdrive_token');
        if (token && window.google) {
            window.google.accounts.oauth2.revoke(token, () => {
                console.log('Token revoked');
            });
        }
        localStorage.removeItem('gdrive_token');
        setAccessToken(null);
    };

    // 3. Upload File
    const uploadFile = async (fileContent: string, fileName: string, mimeType: string = 'text/csv') => {
        if (!accessToken) throw new Error("Not logged in");

        const file = new Blob([fileContent], { type: mimeType });
        const metadata = {
            name: fileName,
            mimeType: mimeType,
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: form,
        });

        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    };

    // 4. List Files (Simple Picker Replacement)
    const listFiles = async () => {
        try {
            const response = await window.gapi.client.drive.files.list({
                'pageSize': 10,
                'fields': 'files(id, name)',
                'q': "mimeType = 'text/csv' and trashed = false"
            });
            return response.result.files;
        } catch (err) {
            console.error(err);
            // If 401, clear token
            if ((err as any)?.status === 401) logout();
            throw err;
        }
    };

    // 5. Download Content
    const downloadFile = async (fileId: string) => {
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        return response.body;
    };

    return {
        isReady: isGapiLoaded && isGisLoaded,
        isAuthenticated: !!accessToken,
        login,
        logout,
        uploadFile,
        listFiles,
        downloadFile
    };
}
