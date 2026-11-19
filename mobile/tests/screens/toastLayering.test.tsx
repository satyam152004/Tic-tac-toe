import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { AppModal, ConfirmDialog } from '../../src/components/common/AppModal';
import { AppToastHost, OverlayToast, withOverlayToast } from '../../src/components/feedback/AppToast';
import { TOAST_DURATION_MS, toast, useToastStore } from '../../src/store/toastStore';

jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (t, k) => (k in t ? (t as any)[k] : () => null) }));

const reset = () => {
  useToastStore.getState().dismiss();
  useToastStore.setState({ overlayCount: 0 });
};
beforeEach(() => {
  jest.useFakeTimers();
  reset();
});
afterEach(() => {
  reset();
  jest.useRealTimers();
});

/** The app tree: the root host plus whatever overlay the test opens. */
const App: React.FC<{ confirm?: boolean; modal?: boolean; both?: boolean }> = ({ confirm, modal, both }) => (
  <>
    <Text>screen</Text>
    <ConfirmDialog open={!!confirm || !!both} title="Sure?" message="m" onConfirm={() => undefined} onCancel={() => undefined} />
    <AppModal open={!!modal || !!both} title="Sheet" onClose={() => undefined}>
      <Text>sheet body</Text>
    </AppModal>
    <AppToastHost />
  </>
);

describe('toast store', () => {
  it('auto-dismisses after the duration', async () => {
    toast.info('Hello');
    expect(useToastStore.getState().toast?.title).toBe('Hello');
    await act(async () => void jest.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(useToastStore.getState().toast).not.toBeNull();
    await act(async () => void jest.advanceTimersByTime(2));
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('does not stack an identical toast, it keeps the same one and extends its timer', async () => {
    toast.error('Failed', 'try again');
    const first = useToastStore.getState().toast;
    await act(async () => void jest.advanceTimersByTime(3000));
    toast.error('Failed', 'try again');
    expect(useToastStore.getState().toast).toBe(first);
    await act(async () => void jest.advanceTimersByTime(3000)); // would have expired without the extension
    expect(useToastStore.getState().toast).not.toBeNull();
    await act(async () => void jest.advanceTimersByTime(600));
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('a different toast replaces the visible one and an old timer cannot dismiss the new toast early', async () => {
    toast.info('One');
    await act(async () => void jest.advanceTimersByTime(3000));
    toast.success('Two');
    expect(useToastStore.getState().toast?.title).toBe('Two');
    await act(async () => void jest.advanceTimersByTime(1000)); // the first toast's timer would fire here
    expect(useToastStore.getState().toast?.title).toBe('Two');
  });

  it('overlay registration is counted and an unregister only counts once', async () => {
    const off = useToastStore.getState().pushOverlay();
    const off2 = useToastStore.getState().pushOverlay();
    expect(useToastStore.getState().overlayCount).toBe(2);
    off();
    off();
    expect(useToastStore.getState().overlayCount).toBe(1);
    off2();
    expect(useToastStore.getState().overlayCount).toBe(0);
  });
});

describe('toast layering', () => {
  it('shows exactly one toast in the root host when nothing is open', async () => {
    await render(<App />);
    await act(async () => toast.info('Plain'));
    expect(screen.getAllByTestId('app-toast')).toHaveLength(1);
    expect(screen.getByText('Plain')).toBeTruthy();
  });

  it('a toast fired while a ConfirmDialog is open is rendered inside the dialog, once', async () => {
    await render(<App confirm />);
    await act(async () => toast.error('Could not log out', 'Network error'));
    expect(screen.getAllByTestId('app-toast')).toHaveLength(1);
    expect(screen.getByText('Could not log out')).toBeTruthy();
    expect(useToastStore.getState().overlayCount).toBe(1);
  });

  it('a toast fired while an AppModal sheet is open is rendered inside the sheet, once', async () => {
    await render(<App modal />);
    await act(async () => toast.error('Could not invite'));
    expect(screen.getAllByTestId('app-toast')).toHaveLength(1);
    expect(useToastStore.getState().overlayCount).toBe(1);
  });

  it('a toast that is already showing moves into a dialog that opens afterwards, still only once', async () => {
    const view = await render(<App />);
    await act(async () => toast.warning('Heads up'));
    expect(screen.getAllByTestId('app-toast')).toHaveLength(1);
    await view.rerender(<App confirm />);
    expect(screen.getAllByTestId('app-toast')).toHaveLength(1);
    expect(useToastStore.getState().overlayCount).toBe(1);
  });

  it('hands the toast back to the root host once the overlay closes', async () => {
    const view = await render(<App confirm />);
    await act(async () => toast.info('Still here'));
    await view.rerender(<App />);
    expect(useToastStore.getState().overlayCount).toBe(0);
    expect(screen.getAllByTestId('app-toast')).toHaveLength(1);
    expect(screen.getByText('Still here')).toBeTruthy();
  });

  it('nested overlays (a dialog above a sheet) never register a leak', async () => {
    const view = await render(<App both />);
    await act(async () => toast.info('Nested'));
    expect(useToastStore.getState().overlayCount).toBe(2);
    await view.rerender(<App modal />);
    expect(useToastStore.getState().overlayCount).toBe(1);
    await view.rerender(<App />);
    expect(useToastStore.getState().overlayCount).toBe(0);
  });

  it('the dismiss button closes the toast wherever it is rendered', async () => {
    await render(<App confirm />);
    await act(async () => toast.info('Bye'));
    await fireEvent.press(screen.getByLabelText('Dismiss notification'));
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('modal-presented screens host their own toast layer through withOverlayToast', async () => {
    const Inner = () => <Text>invitation</Text>;
    const Wrapped = withOverlayToast(Inner);
    const view = await render(
      <>
        <Wrapped />
        <AppToastHost />
      </>,
    );
    await act(async () => toast.info('Invite'));
    expect(screen.getAllByTestId('app-toast')).toHaveLength(1);
    expect(useToastStore.getState().overlayCount).toBe(1);
    await view.unmount();
    expect(useToastStore.getState().overlayCount).toBe(0);
  });

  it('OverlayToast unregisters on unmount', async () => {
    const view = await render(<OverlayToast />);
    expect(useToastStore.getState().overlayCount).toBe(1);
    await view.unmount();
    expect(useToastStore.getState().overlayCount).toBe(0);
  });
});
