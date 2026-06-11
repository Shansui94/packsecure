import dns from 'dns';

dns.lookup('kdahubyhwndgyloaljak.supabase.co', (err, address, family) => {
    console.log('API Host kdahubyhwndgyloaljak.supabase.co:', { err, address, family });
});

dns.lookup('db.kdahubyhwndgyloaljak.supabase.co', (err, address, family) => {
    console.log('DB Host db.kdahubyhwndgyloaljak.supabase.co:', { err, address, family });
});

dns.resolveMx('kdahubyhwndgyloaljak.supabase.co', (err, addresses) => {
    console.log('MX:', { err, addresses });
});
