import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { AppButton } from '../../src/components/common/AppButton';

// NOTE: @testing-library/react-native v14: render / fireEvent / rerender are async and must be awaited.
describe('AppButton', () => {
  it('renders its title and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<AppButton title="Play" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Play'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled or loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<AppButton title="Go" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByLabelText('Go'));
    await rerender(<AppButton title="Go" onPress={onPress} loading />);
    await fireEvent.press(screen.getByLabelText('Go'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
