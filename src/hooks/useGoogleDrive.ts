
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

    // ... (Login Flow) ...

    return {
        isReady: isGapiLoaded && isGisLoaded,
        isAuthenticated: !!accessToken,
        login,
        logout,
        uploadFile,
        listFiles,
        downloadFile,
        error,
        debugStatus
    };
}
