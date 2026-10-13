import React from 'react';
import { createRoot } from 'react-dom/client';
import { Library } from '@folio/ui';
import { browserPlatform } from '@folio/platform';
function App() { const [documents,setDocuments] = React.useState<Awaited<ReturnType<typeof browserPlatform.listDocuments>>>([]); React.useEffect(()=>{void browserPlatform.listDocuments().then(setDocuments);},[]); return <Library documents={documents}/>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
