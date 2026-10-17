import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app';
import {ApiProviderSettings} from './api-settings';
import type {TranslationProvider} from '@folio/core';
function Workspace(){
 const [provider,setProvider]=React.useState<TranslationProvider|undefined>();
 return <><ApiProviderSettings onChange={setProvider}/><App translationProvider={provider}/></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Workspace/></React.StrictMode>);
