import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Library } from './index';
it('shows the empty library state', () => { render(<Library documents={[]} />); expect(screen.getByText('Your library is empty. PDF import arrives in F01.')).toBeTruthy(); });
it('renders imported document summaries', () => { render(<Library documents={[{id:'one',title:'Example',progress:42}]} />); expect(screen.getByText('Example — 42%')).toBeTruthy(); });
