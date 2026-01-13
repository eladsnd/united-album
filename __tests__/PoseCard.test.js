import { render, screen } from '@testing-library/react';
import PoseCard from '../components/PoseCard';

const mockChallenge = {
    id: 1,
    title: 'Test Pose',
    instruction: 'Do something cool',
    image: '/challenges/test.png'
};

describe('PoseCard', () => {
    it('renders challenge title and instruction', () => {
        render(<PoseCard challenge={mockChallenge} />);

        expect(screen.getByText('Test Pose')).toBeInTheDocument();
        expect(screen.getByText('"Do something cool"')).toBeInTheDocument();
    });

    it('renders challenge image with correct alt text', () => {
        render(<PoseCard challenge={mockChallenge} />);

        const img = screen.getByAltText('Test Pose');
        expect(img).toBeInTheDocument();
        expect(img.getAttribute('src')).toContain('test.png');
    });
});
