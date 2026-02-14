import { Platform, Alert } from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
}

const isWeb = (Platform.OS as string) === 'web';

export function alert(
  title: string,
  message?: string,
  buttons?: Array<AlertButton>
): void {
  if (!title) return;

  if (isWeb) {
    const alertMessage = message ? `${title}\n\n${message}` : title;

    if (buttons && buttons.length === 2) {
      const confirmed = window.confirm(alertMessage);
      const target = confirmed ? buttons[1] : buttons[0];
      target.onPress?.();
    } else {
      window.alert(alertMessage);
      if (buttons?.[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}
