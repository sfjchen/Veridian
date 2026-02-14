import { Platform, Alert } from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
}

export function alert(
  title: string,
  message?: string,
  buttons?: Array<AlertButton>
): void {
  if (Platform.OS === 'web') {
    const alertMessage = message ? `${title}: ${message}` : title;
    window.alert(alertMessage);

    if (buttons && buttons.length > 0 && buttons[0].onPress) {
      buttons[0].onPress();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}
