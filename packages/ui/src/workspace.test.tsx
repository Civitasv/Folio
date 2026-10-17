import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {WorkspaceShell,WorkspaceToolbar,SidebarItem,Surface,ActionButton} from './workspace';
afterEach(()=>cleanup());
it('renders named complementary regions with content and navigation',()=>{
 render(<WorkspaceShell navigation={<span>All items</span>} inspector={<span>Metadata</span>}><article>Read content</article></WorkspaceShell>);
 expect(screen.getByRole('complementary',{name:'Library navigation'}).textContent).toContain('All items');
 expect(screen.getByRole('complementary',{name:'Context inspector'}).textContent).toContain('Metadata');
 expect(screen.getByText('Read content')).toBeTruthy();
});
it('places title and toolbar actions in predictable positions',()=>{
 render(<WorkspaceToolbar title={<span>Paper</span>} actions={<button>Close</button>}/>);
 expect(screen.getByRole('banner').textContent).toContain('Paper');
 expect(screen.getByRole('button',{name:'Close'})).toBeTruthy();
});
it('marks selected navigation and respects each action',()=>{
 const selected=vi.fn(),other=vi.fn();
 render(<><SidebarItem active label="PDF" onClick={selected}/><SidebarItem active={false} label="EPUB" onClick={other}/></>);
 expect(screen.getByRole('button',{name:'PDF'}).getAttribute('aria-current')).toBe('page');
 expect(screen.getByRole('button',{name:'EPUB'}).getAttribute('aria-current')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'PDF'}));fireEvent.click(screen.getByRole('button',{name:'EPUB'}));
 expect(selected).toHaveBeenCalledOnce();expect(other).toHaveBeenCalledOnce();
});
it('renders named surfaces with primary, quiet, destructive and disabled actions',()=>{
 const action=vi.fn();
 render(<Surface title="Details"><p>Journal</p>
  <ActionButton tone="primary" onClick={action}>Import</ActionButton>
  <ActionButton tone="quiet" disabled>Loading</ActionButton>
  <ActionButton tone="danger">Delete</ActionButton></Surface>);
 expect(screen.getByRole('region',{name:'Details'}).textContent).toContain('Journal');
 fireEvent.click(screen.getByRole('button',{name:'Import'}));expect(action).toHaveBeenCalledOnce();
 expect(screen.getByRole('button',{name:'Loading'})).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Delete'}).className).toContain('folio-action--danger');
});
