import type {ButtonHTMLAttributes,ReactNode} from 'react';
/** Presentation-only; never stores documents or invokes native platform APIs. */
export function WorkspaceShell({navigation,children,inspector}:{navigation:ReactNode;children:ReactNode;inspector:ReactNode}){
 return <div className="folio-workspace"><aside aria-label="Library navigation" className="folio-navigation">{navigation}</aside><div className="folio-workspace-main">{children}</div><aside aria-label="Context inspector" className="folio-inspector">{inspector}</aside></div>;
}
export function WorkspaceToolbar({title,actions}:{title:ReactNode;actions:ReactNode}){
 return <header className="folio-toolbar"><div className="folio-toolbar-title">{title}</div><div className="folio-toolbar-actions">{actions}</div></header>;
}
export function SidebarItem({active,label,onClick}:{active:boolean;label:string;onClick:()=>void}){
 return <button type="button" className={active?'folio-sidebar-item is-active':'folio-sidebar-item'} aria-current={active?'page':undefined} onClick={onClick}>{label}</button>;
}
export function Surface({title,children}:{title:string;children:ReactNode}){
 return <section className="folio-surface" aria-label={title}><h2 className="folio-surface-title">{title}</h2>{children}</section>;
}
export function ActionButton({tone,children,...rest}:ButtonHTMLAttributes<HTMLButtonElement>&{tone:'primary'|'quiet'|'danger'}){
 return <button type="button" {...rest} className={`folio-action folio-action--${tone}`}>{children}</button>;
}
