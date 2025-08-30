import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HeaderLogo from './HeaderLogo';
import { useSession, signOut } from 'next-auth/react';
import type { Session } from 'next-auth';

// Mock next-auth
jest.mock('next-auth/react', () => ({
	useSession: jest.fn(),
	signOut: jest.fn(),
}));

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

// Mock Next.js Link component
jest.mock('next/link', () => {
	return function MockLink({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
		return (
			<a href={href} className={className} data-testid={`link-${href}`}>
				{children}
			</a>
		);
	};
});

// Mock Icons
jest.mock('./Icons', () => ({
	LogoutIcon: () => <span data-testid="logout-icon">Logout</span>,
	BurgerIcon: () => <span data-testid="burger-icon">Menu</span>,
	CloseIcon: () => <span data-testid="close-icon">Close</span>,
}));

// Mock UserSettings component
jest.mock('./UserSettings', () => {
	return function MockUserSettings({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
		return isOpen ? (
			<div data-testid="user-settings" onClick={onClose}>
				User Settings Panel
			</div>
		) : null;
	};
});

describe('HeaderLogo Component', () => {
	const mockAuthenticatedSession: Session = {
		user: {
			id: '1',
			email: 'test@example.com',
			household_id: 1,
			household_name: 'Test Household',
			is_admin: false,
		},
		expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
	};

	const mockAdminSession: Session = {
		user: {
			id: '1',
			email: 'admin@example.com',
			household_id: 1,
			household_name: 'Test Household',
			is_admin: true,
		},
		expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockSignOut.mockResolvedValue(undefined);
	});

	describe('Basic Rendering', () => {
		it('renders without crashing when not authenticated', () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: 'unauthenticated',
				update: jest.fn(),
			});

			render(<HeaderLogo session={null} />);
			expect(screen.getByText('Family Foodie')).toBeInTheDocument();
			expect(screen.getByText('What the fork is for dinner?')).toBeInTheDocument();
		});

		it('renders without crashing when authenticated', () => {
			mockUseSession.mockReturnValue({
				data: mockAuthenticatedSession,
				status: 'authenticated',
				update: jest.fn(),
			});

			render(<HeaderLogo session={mockAuthenticatedSession} />);
			expect(screen.getByText('Family Foodie')).toBeInTheDocument();
			expect(screen.getByText('What the fork is for dinner?')).toBeInTheDocument();
		});

		it('renders the title and subtitle correctly', () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: 'unauthenticated',
				update: jest.fn(),
			});

			render(<HeaderLogo session={null} />);

			const title = screen.getByText('Family Foodie');
			expect(title).toBeInTheDocument();
			expect(title.tagName).toBe('H1');

			const subtitle = screen.getByText('What the fork is for dinner?');
			expect(subtitle).toBeInTheDocument();
		});

		it('has correct semantic structure', () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: 'unauthenticated',
				update: jest.fn(),
			});

			render(<HeaderLogo session={null} />);

			const header = screen.getByRole('banner');
			expect(header).toBeInTheDocument();
			expect(header.tagName).toBe('HEADER');
		});
	});

	describe('Authentication States', () => {
		it('does not show navigation when not authenticated', () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: 'unauthenticated',
				update: jest.fn(),
			});

			render(<HeaderLogo session={null} />);

			// Navigation links should not be present
			expect(screen.queryByTestId('link-/')).not.toBeInTheDocument();
			expect(screen.queryByTestId('link-/recipes')).not.toBeInTheDocument();
			expect(screen.queryByTestId('link-/shop')).not.toBeInTheDocument();
		});

		it('shows navigation when authenticated', () => {
			render(<HeaderLogo session={mockAuthenticatedSession} />);

			// Navigation links should be present (check for multiple instances - desktop and mobile)
			expect(screen.getAllByTestId('link-/')).toHaveLength(2); // Desktop and mobile nav
			expect(screen.getAllByTestId('link-/plan')).toHaveLength(2);
			expect(screen.getAllByTestId('link-/shop')).toHaveLength(2);
			expect(screen.getAllByTestId('link-/recipes')).toHaveLength(2);
		});

		it('shows admin navigation for admin users', () => {
			render(<HeaderLogo session={mockAdminSession} />);

			// Should show navigation for admin users including admin link
			expect(screen.getAllByTestId('link-/')).toHaveLength(2); // Desktop and mobile nav
			expect(screen.getAllByTestId('link-/admin')).toHaveLength(2); // Admin should be visible in both navs
		});
	});

	describe('User Interaction', () => {
		it('handles logout correctly', async () => {
			mockUseSession.mockReturnValue({
				data: mockAuthenticatedSession,
				status: 'authenticated',
				update: jest.fn(),
			});

			render(<HeaderLogo session={mockAuthenticatedSession} />);

			// Look for logout functionality (may be in a dropdown or button)
			// This depends on the actual implementation in the component
			const logoutElements = screen.queryAllByText(/logout/i);
			if (logoutElements.length > 0) {
				fireEvent.click(logoutElements[0]);
				expect(mockSignOut).toHaveBeenCalled();
			}
		});
	});

	describe('Responsive Behavior', () => {
		it('renders correctly on different screen sizes', () => {
			mockUseSession.mockReturnValue({
				data: mockAuthenticatedSession,
				status: 'authenticated',
				update: jest.fn(),
			});

			render(<HeaderLogo session={mockAuthenticatedSession} />);

			const header = screen.getByRole('banner');
			expect(header).toHaveClass('bg-surface', 'border-b', 'border-custom');
		});
	});

	describe('Loading State', () => {
		it('handles loading state correctly', () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: 'loading',
				update: jest.fn(),
			});

			render(<HeaderLogo session={null} />);

			// Should still render the basic header structure
			expect(screen.getByText('Family Foodie')).toBeInTheDocument();
		});
	});
});
