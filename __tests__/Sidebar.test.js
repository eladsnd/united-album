import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/Sidebar';

describe('Sidebar Component', () => {
    const mockSetActiveSection = jest.fn();

    it('renders all navigation items', () => {
        render(<Sidebar activeSection="challenge" setActiveSection={mockSetActiveSection} />);

        expect(screen.getByText('Pose Challenge')).toBeInTheDocument();
        expect(screen.getByText('Album Gallery')).toBeInTheDocument();
        expect(screen.getByText('App Access')).toBeInTheDocument();
        expect(screen.getByText('UNITED ALBUM')).toBeInTheDocument();
    });

    it('calls setActiveSection when an item is clicked', () => {
        render(<Sidebar activeSection="challenge" setActiveSection={mockSetActiveSection} />);

        fireEvent.click(screen.getByText('Album Gallery'));
        expect(mockSetActiveSection).toHaveBeenCalledWith('gallery');

        fireEvent.click(screen.getByText('App Access'));
        expect(mockSetActiveSection).toHaveBeenCalledWith('access');
    });

    it('highlights the active section', () => {
        const { rerender } = render(<Sidebar activeSection="challenge" setActiveSection={mockSetActiveSection} />);

        expect(screen.getByText('Pose Challenge').closest('button')).toHaveClass('active');
        expect(screen.getByText('Album Gallery').closest('button')).not.toHaveClass('active');

        rerender(<Sidebar activeSection="gallery" setActiveSection={mockSetActiveSection} />);
        expect(screen.getByText('Album Gallery').closest('button')).toHaveClass('active');
    });
});
